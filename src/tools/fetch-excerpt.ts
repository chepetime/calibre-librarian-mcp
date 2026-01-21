import { z } from "zod";
import type { InferSchema } from "xmcp";

import { config } from "../config";
import { getBookWithFormats } from "../utils/books";
import {
  convertToText,
  getFormatExtension,
  selectBestFormat,
  getAvailableFormats,
} from "../utils/ebook-convert";

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

// Utilities imported from ../utils/ebook-convert

export default async function fetchExcerpt({
  bookId,
  maxChars,
  format: preferredFormat,
}: InferSchema<typeof schema>): Promise<string> {
  // Get book info
  const bookInfo = await getBookWithFormats(bookId);

  if (!bookInfo) {
    return `Book not found with ID: ${bookId}`;
  }

  if (bookInfo.formats.length === 0) {
    return `No formats available for book: "${bookInfo.title}"`;
  }

  // Select format to use
  const selectedPath = selectBestFormat(bookInfo.formats, preferredFormat);

  if (!selectedPath) {
    const availableFormats = getAvailableFormats(bookInfo.formats).join(", ");
    return `Format "${preferredFormat}" not available. Available formats: ${availableFormats}`;
  }

  const formatUsed = getFormatExtension(selectedPath).toUpperCase();

  try {
    // Convert to text
    const fullText = await convertToText(selectedPath, {
      timeoutMs: config.commandTimeoutMs,
    });

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
