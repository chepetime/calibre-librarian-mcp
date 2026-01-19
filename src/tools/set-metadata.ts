import { z } from "zod";
import type { InferSchema } from "xmcp";

import { runCalibredb } from "../utils/calibredb";

export const schema = {
  bookId: z
    .number()
    .int()
    .positive()
    .describe("Calibre book ID to update."),
  title: z
    .string()
    .optional()
    .describe("New title for the book."),
  authors: z
    .string()
    .optional()
    .describe("New author(s). For multiple authors, separate with '&' (e.g., 'Author One & Author Two')."),
  tags: z
    .string()
    .optional()
    .describe("New tags. Comma-separated list (e.g., 'fiction, fantasy, epic'). Replaces existing tags."),
  series: z
    .string()
    .optional()
    .describe("Series name. Set to empty string to remove from series."),
  seriesIndex: z
    .number()
    .optional()
    .describe("Position in series (e.g., 1, 2, 3). Only used if series is also set."),
  publisher: z
    .string()
    .optional()
    .describe("Publisher name."),
  rating: z
    .number()
    .int()
    .min(0)
    .max(10)
    .optional()
    .describe("Rating from 0-10 (Calibre uses 0-10 scale internally, displayed as 0-5 stars)."),
  comments: z
    .string()
    .optional()
    .describe("Book description/comments. Supports HTML."),
  languages: z
    .string()
    .optional()
    .describe("Language(s) as ISO 639 codes, comma-separated (e.g., 'eng' or 'eng, spa')."),
};

export const metadata = {
  name: "set_metadata",
  description:
    "Update metadata fields for a book. WARNING: This modifies your Calibre library. Only specified fields will be updated; others remain unchanged. Use get_book_details first to see current values.",
  annotations: {
    title: "Set book metadata",
    idempotentHint: false,
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: false,
  },
};

export default async function setMetadata({
  bookId,
  title,
  authors,
  tags,
  series,
  seriesIndex,
  publisher,
  rating,
  comments,
  languages,
}: InferSchema<typeof schema>): Promise<string> {
  // Collect all field updates
  const fields: string[] = [];

  if (title !== undefined) fields.push(`title:${title}`);
  if (authors !== undefined) fields.push(`authors:${authors}`);
  if (tags !== undefined) fields.push(`tags:${tags}`);
  if (series !== undefined) fields.push(`series:${series}`);
  if (seriesIndex !== undefined) fields.push(`series_index:${seriesIndex}`);
  if (publisher !== undefined) fields.push(`publisher:${publisher}`);
  if (rating !== undefined) fields.push(`rating:${rating}`);
  if (comments !== undefined) fields.push(`comments:${comments}`);
  if (languages !== undefined) fields.push(`languages:${languages}`);

  if (fields.length === 0) {
    return "No fields specified to update. Please provide at least one field (title, authors, tags, series, etc.).";
  }

  // First, get current book info for comparison
  let bookTitle = `Book ID ${bookId}`;
  try {
    const bookOutput = await runCalibredb([
      "list",
      "--fields",
      "id,title,authors",
      "--search",
      `id:${bookId}`,
      "--for-machine",
    ]);

    if (bookOutput) {
      const books = JSON.parse(bookOutput);
      if (Array.isArray(books) && books.length > 0) {
        bookTitle = books[0].title || bookTitle;
      } else {
        return `Book not found with ID: ${bookId}`;
      }
    }
  } catch {
    // Continue anyway
  }

  // Build the set_metadata command
  const args = ["set_metadata", String(bookId)];

  for (const field of fields) {
    args.push("--field", field);
  }

  try {
    await runCalibredb(args);

    // Build summary of changes
    const changes: string[] = [];
    if (title !== undefined) changes.push(`- **Title:** ${title}`);
    if (authors !== undefined) changes.push(`- **Authors:** ${authors}`);
    if (tags !== undefined) changes.push(`- **Tags:** ${tags}`);
    if (series !== undefined) {
      const seriesStr = series
        ? `${series}${seriesIndex !== undefined ? ` #${seriesIndex}` : ""}`
        : "(removed from series)";
      changes.push(`- **Series:** ${seriesStr}`);
    }
    if (publisher !== undefined) changes.push(`- **Publisher:** ${publisher}`);
    if (rating !== undefined) changes.push(`- **Rating:** ${rating}/10 (${rating / 2} stars)`);
    if (comments !== undefined) changes.push(`- **Comments:** (updated)`);
    if (languages !== undefined) changes.push(`- **Languages:** ${languages}`);

    const lines = [
      "# Metadata Updated",
      "",
      `**Book:** ${bookTitle} (ID: ${bookId})`,
      "",
      "## Changes Applied",
      ...changes,
      "",
      "Use `get_book_details` to verify the updated metadata.",
    ];

    return lines.join("\n");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Provide helpful error messages
    if (errorMessage.includes("No book with id")) {
      return `Book not found with ID: ${bookId}`;
    }

    return `Failed to update metadata: ${errorMessage}`;
  }
}
