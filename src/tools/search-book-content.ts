import { z } from "zod";
import type { InferSchema } from "xmcp";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { config } from "../config";
import { getBookWithFormats } from "../utils/books";

export const schema = {
  bookId: z
    .number()
    .int()
    .positive()
    .describe("Calibre book ID to search within."),
  query: z
    .string()
    .min(1)
    .describe("Text to search for within the book content. Case-insensitive."),
  contextChars: z
    .number()
    .int()
    .positive()
    .max(500)
    .default(150)
    .describe(
      "Characters of context to show around each match (default: 150)."
    ),
  maxMatches: z
    .number()
    .int()
    .positive()
    .max(20)
    .default(10)
    .describe("Maximum number of matches to return (default: 10, max: 20)."),
};

export const metadata = {
  name: "search_book_content",
  description:
    "Search for text within a specific book's content. Plain-text fallback when Calibre FTS is not available. Extracts the book to text and searches for matches with surrounding context.",
  annotations: {
    title: "Search book content",
    idempotentHint: true,
    readOnlyHint: true,
    destructiveHint: false,
  },
};

interface Match {
  position: number;
  snippet: string;
}

function getFormatExtension(path: string): string {
  return path.split(".").pop()?.toLowerCase() || "";
}

async function convertToText(
  inputPath: string,
  timeoutMs: number
): Promise<string> {
  const outputPath = join(tmpdir(), `calibre-search-${randomUUID()}.txt`);

  return new Promise((resolve, reject) => {
    const child = spawn("ebook-convert", [inputPath, outputPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`ebook-convert timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", async (code) => {
      clearTimeout(timer);
      if (code === 0) {
        try {
          const text = await readFile(outputPath, "utf8");
          await unlink(outputPath).catch(() => {});
          resolve(text);
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error(`ebook-convert exited with code ${code}`));
      }
    });
  });
}

function findMatches(
  text: string,
  query: string,
  contextChars: number,
  maxMatches: number
): Match[] {
  const matches: Match[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  let startPos = 0;
  while (matches.length < maxMatches) {
    const pos = lowerText.indexOf(lowerQuery, startPos);
    if (pos === -1) break;

    // Extract context around the match
    const contextStart = Math.max(0, pos - contextChars);
    const contextEnd = Math.min(text.length, pos + query.length + contextChars);

    let snippet = text.slice(contextStart, contextEnd);

    // Add ellipsis if truncated
    if (contextStart > 0) snippet = "..." + snippet;
    if (contextEnd < text.length) snippet = snippet + "...";

    // Clean up whitespace
    snippet = snippet.replace(/\s+/g, " ").trim();

    matches.push({ position: pos, snippet });

    startPos = pos + query.length;
  }

  return matches;
}

export default async function searchBookContent({
  bookId,
  query,
  contextChars,
  maxMatches,
}: InferSchema<typeof schema>): Promise<string> {
  // Get book info
  const bookInfo = await getBookWithFormats(bookId);

  if (!bookInfo) {
    return `Book not found with ID: ${bookId}`;
  }

  if (bookInfo.formats.length === 0) {
    return `No formats available for book: "${bookInfo.title}"`;
  }

  // Select best format for text extraction
  const preferenceOrder = ["epub", "txt", "mobi", "azw3", "pdf"];
  let selectedPath: string | null = null;

  for (const fmt of preferenceOrder) {
    selectedPath =
      bookInfo.formats.find((p) => getFormatExtension(p) === fmt) || null;
    if (selectedPath) break;
  }

  if (!selectedPath) {
    selectedPath = bookInfo.formats[0];
  }

  try {
    // Convert to text
    const fullText = await convertToText(selectedPath, config.commandTimeoutMs);

    // Search for matches
    const matches = findMatches(fullText, query, contextChars, maxMatches);

    if (matches.length === 0) {
      return `No matches found for "${query}" in "${bookInfo.title}"`;
    }

    const lines = [
      `# Search results in "${bookInfo.title}"`,
      `**Author:** ${bookInfo.authors}`,
      `**Query:** "${query}"`,
      `**Matches found:** ${matches.length}${matches.length === maxMatches ? " (limit reached)" : ""}`,
      "",
    ];

    for (let i = 0; i < matches.length; i++) {
      lines.push(`### Match ${i + 1}`);
      lines.push(matches[i].snippet);
      lines.push("");
    }

    return lines.join("\n");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Failed to search "${bookInfo.title}": ${errorMessage}\n\nThis may happen if ebook-convert is not available or the book format is not supported.`;
  }
}
