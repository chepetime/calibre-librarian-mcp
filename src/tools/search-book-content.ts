import { z } from "zod";
import type { InferSchema } from "xmcp";

import { config } from "../config";
import { getBookWithFormats } from "../utils/books";
import { convertToText, selectBestFormat } from "../utils/ebook-convert";

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
  const selectedPath = selectBestFormat(bookInfo.formats);

  if (!selectedPath) {
    return `No suitable format available for text extraction in "${bookInfo.title}"`;
  }

  try {
    // Convert to text
    const fullText = await convertToText(selectedPath, {
      timeoutMs: config.commandTimeoutMs,
    });

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
