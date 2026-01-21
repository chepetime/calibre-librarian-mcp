import { z } from "zod";
import type { InferSchema } from "xmcp";

import { runCalibredb } from "../utils/calibredb";
import { invalidateCache } from "../utils/cache";
import { assertWriteEnabled } from "../config";
import { bookExists } from "../utils/books";

export const schema = {
  bookId: z
    .number()
    .int()
    .positive()
    .describe("Calibre book ID to update."),
  column: z
    .string()
    .min(1)
    .describe(
      "Custom column name (without the # prefix). Use get_custom_columns to see available columns."
    ),
  value: z
    .string()
    .describe(
      "New value for the custom column. For boolean columns use 'true'/'false'. For multiple-value columns, separate values with commas."
    ),
  append: z
    .boolean()
    .default(false)
    .describe(
      "If true, append value to existing values (for multiple-value columns). If false (default), replace existing value."
    ),
};

export const metadata = {
  name: "set_custom_column",
  description:
    "Update a custom column value for a book. WARNING: This modifies your Calibre library. Use get_custom_columns to see available columns and get_book_details to verify the book before updating.",
  annotations: {
    title: "Set custom column value",
    idempotentHint: false,
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: false,
  },
};

export default async function setCustomColumn({
  bookId,
  column,
  value,
  append,
}: InferSchema<typeof schema>): Promise<string> {
  // Check if write operations are enabled
  assertWriteEnabled();

  // Remove # prefix if user included it
  const columnName = column.startsWith("#") ? column.slice(1) : column;

  // First, verify the book exists and get its title
  const book = await bookExists(bookId);
  if (!book) {
    return `Book not found with ID: ${bookId}`;
  }
  const bookTitle = book.title;

  // Build the set_custom command
  const args = ["set_custom", columnName, String(bookId), value];

  if (append) {
    args.push("--append");
  }

  try {
    await runCalibredb(args);

    // Invalidate cache after successful write
    invalidateCache();

    // Verify the change by reading back the value
    let newValue = value;
    try {
      const verifyOutput = await runCalibredb([
        "list",
        "--fields",
        `id,*${columnName}`,
        "--search",
        `id:${bookId}`,
        "--for-machine",
      ]);

      if (verifyOutput) {
        const books = JSON.parse(verifyOutput);
        if (Array.isArray(books) && books.length > 0) {
          newValue = books[0][`*${columnName}`] || value;
        }
      }
    } catch {
      // Verification failed, but the set operation succeeded
    }

    const lines = [
      "# Custom Column Updated",
      "",
      `**Book:** ${bookTitle} (ID: ${bookId})`,
      `**Column:** #${columnName}`,
      `**New value:** ${newValue}`,
      append ? "**Mode:** Appended to existing values" : "",
      "",
      "The custom column has been updated successfully.",
    ].filter(Boolean);

    return lines.join("\n");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Provide helpful error messages
    if (errorMessage.includes("No such column")) {
      return `Custom column "#${columnName}" does not exist.\n\nUse get_custom_columns to see available columns in your library.`;
    }

    if (errorMessage.includes("Invalid value")) {
      return `Invalid value "${value}" for column "#${columnName}".\n\nCheck the column's data type using get_custom_columns with details: true.`;
    }

    return `Failed to update custom column: ${errorMessage}`;
  }
}
