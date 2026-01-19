import { z } from "zod";
import type { InferSchema } from "xmcp";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { runCalibredb } from "../utils/calibredb";
import { config } from "../config";

export const schema = {
  bookId: z
    .number()
    .int()
    .positive()
    .describe("Calibre book ID to fetch excerpt from."),
  maxChars: z
    .number()
    .int()
    .positive()
    .max(10000)
    .default(2000)
    .describe(
      "Maximum characters to return (default: 2000, max: 10000). Keeps excerpts brief."
    ),
  format: z
    .enum(["epub", "mobi", "azw3", "pdf", "txt"])
    .optional()
    .describe(
      "Preferred format to extract from. If not specified, uses the first available format."
    ),
};

export const metadata = {
  name: "fetch_excerpt",
  description:
    "Fetch a short text excerpt from a book's content. Extracts the beginning of a book to preview its content. Useful for checking writing style, confirming the right book, or getting a taste of the content.",
  annotations: {
    title: "Fetch book excerpt",
    idempotentHint: true,
    readOnlyHint: true,
    destructiveHint: false,
  },
};

interface BookInfo {
  id: number;
  title: string;
  authors: string;
  formats: string[];
}

async function getBookInfo(bookId: number): Promise<BookInfo | null> {
  try {
    const output = await runCalibredb([
      "list",
      "--fields",
      "id,title,authors,formats",
      "--search",
      `id:${bookId}`,
      "--for-machine",
    ]);

    if (!output) return null;

    const books = JSON.parse(output);
    if (!Array.isArray(books) || books.length === 0) return null;

    const book = books[0];
    // formats comes as comma-separated string of paths
    const formatPaths = book.formats ? book.formats.split(", ") : [];

    return {
      id: book.id,
      title: book.title,
      authors: book.authors,
      formats: formatPaths,
    };
  } catch {
    return null;
  }
}

function getFormatExtension(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return ext;
}

async function convertToText(
  inputPath: string,
  timeoutMs: number
): Promise<string> {
  const outputPath = join(tmpdir(), `calibre-excerpt-${randomUUID()}.txt`);

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
          // Clean up temp file
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

export default async function fetchExcerpt({
  bookId,
  maxChars,
  format: preferredFormat,
}: InferSchema<typeof schema>): Promise<string> {
  // Get book info
  const bookInfo = await getBookInfo(bookId);

  if (!bookInfo) {
    return `Book not found with ID: ${bookId}`;
  }

  if (bookInfo.formats.length === 0) {
    return `No formats available for book: "${bookInfo.title}"`;
  }

  // Select format to use
  let selectedPath: string | null = null;

  if (preferredFormat) {
    selectedPath =
      bookInfo.formats.find(
        (p) => getFormatExtension(p) === preferredFormat.toLowerCase()
      ) || null;

    if (!selectedPath) {
      const availableFormats = bookInfo.formats
        .map((p) => getFormatExtension(p).toUpperCase())
        .join(", ");
      return `Format "${preferredFormat}" not available. Available formats: ${availableFormats}`;
    }
  } else {
    // Prefer text-friendly formats
    const preferenceOrder = ["epub", "txt", "mobi", "azw3", "pdf"];
    for (const fmt of preferenceOrder) {
      selectedPath =
        bookInfo.formats.find((p) => getFormatExtension(p) === fmt) || null;
      if (selectedPath) break;
    }
    // Fall back to first available
    if (!selectedPath) {
      selectedPath = bookInfo.formats[0];
    }
  }

  const formatUsed = getFormatExtension(selectedPath).toUpperCase();

  try {
    // Convert to text
    const fullText = await convertToText(selectedPath, config.commandTimeoutMs);

    // Trim to max characters
    let excerpt = fullText.slice(0, maxChars);

    // Try to end at a sentence or paragraph boundary
    if (excerpt.length === maxChars) {
      const lastPeriod = excerpt.lastIndexOf(". ");
      const lastNewline = excerpt.lastIndexOf("\n");
      const cutoff = Math.max(lastPeriod, lastNewline);

      if (cutoff > maxChars * 0.7) {
        excerpt = excerpt.slice(0, cutoff + 1);
      }
      excerpt += "\n\n[... excerpt truncated ...]";
    }

    // Clean up excessive whitespace
    excerpt = excerpt.replace(/\n{3,}/g, "\n\n").trim();

    const lines = [
      `# Excerpt from "${bookInfo.title}"`,
      `**Author:** ${bookInfo.authors}`,
      `**Format:** ${formatUsed}`,
      "",
      "---",
      "",
      excerpt,
    ];

    return lines.join("\n");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Failed to extract excerpt from "${bookInfo.title}": ${errorMessage}\n\nThis may happen if ebook-convert is not available or the book format is not supported.`;
  }
}
