import { z } from "zod";
import type { InferSchema } from "xmcp";

import { runCalibredb } from "../utils/calibredb";
import { assertWriteEnabled } from "../config";

export const schema = {
  preview: z
    .boolean()
    .default(true)
    .describe(
      "If true (default), only show what would be changed. Set to false to apply changes."
    ),
  authorId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Optional: Only normalize books by a specific author ID. Use search_authors_by_name to find IDs."
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .default(50)
    .describe("Maximum books to process (default: 50)."),
};

export const metadata = {
  name: "normalize_author_sort",
  description:
    "Find and fix inconsistent author_sort values. Calibre uses author_sort for proper alphabetization (e.g., 'Tolkien, J.R.R.' for 'J.R.R. Tolkien'). Preview changes before applying.",
  annotations: {
    title: "Normalize author_sort",
    idempotentHint: false,
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: false,
  },
};

interface Book {
  id: number;
  title: string;
  authors: string;
  author_sort: string;
}

interface AuthorInfo {
  id: number;
  name: string;
}

/**
 * Generate expected author_sort from author name.
 * Standard format: "LastName, FirstName MiddleName"
 */
function generateAuthorSort(authorName: string): string {
  // Handle multiple authors (separated by &)
  if (authorName.includes("&")) {
    return authorName
      .split("&")
      .map((a) => generateAuthorSort(a.trim()))
      .join(" & ");
  }

  const name = authorName.trim();

  // Already in "Last, First" format
  if (name.includes(",")) {
    return name;
  }

  // Handle special cases
  // Names with Jr., Sr., III, etc.
  const suffixMatch = name.match(/^(.+?)\s+(Jr\.?|Sr\.?|III|IV|II)$/i);
  if (suffixMatch) {
    const baseName = suffixMatch[1];
    const suffix = suffixMatch[2];
    const baseSort = generateAuthorSort(baseName);
    return `${baseSort}, ${suffix}`;
  }

  // Standard "First Last" -> "Last, First"
  const parts = name.split(/\s+/);

  if (parts.length === 1) {
    return name; // Single name, no change
  }

  const lastName = parts[parts.length - 1];
  const firstNames = parts.slice(0, -1).join(" ");

  return `${lastName}, ${firstNames}`;
}

async function getAuthorName(authorId: number): Promise<string | null> {
  try {
    const output = await runCalibredb(["list_categories", "--for-machine"]);
    if (!output) return null;

    const categories = JSON.parse(output);
    const authors = categories.authors as AuthorInfo[];
    const author = authors.find((a) => a.id === authorId);
    return author?.name || null;
  } catch {
    return null;
  }
}

async function getBooks(authorName?: string, limit?: number): Promise<Book[]> {
  const args = [
    "list",
    "--fields",
    "id,title,authors,author_sort",
    "--for-machine",
  ];

  if (authorName) {
    args.push("--search", `author:"=${authorName}"`);
  }

  if (limit) {
    args.push("--limit", String(limit));
  }

  const output = await runCalibredb(args);
  if (!output) return [];

  const books = JSON.parse(output);
  return books.map((b: Record<string, unknown>) => ({
    id: b.id as number,
    title: b.title as string,
    authors: b.authors as string,
    author_sort: b.author_sort as string,
  }));
}

interface NormalizationResult {
  book: Book;
  currentSort: string;
  expectedSort: string;
  needsUpdate: boolean;
}

function analyzeBooks(books: Book[]): NormalizationResult[] {
  return books.map((book) => {
    const expectedSort = generateAuthorSort(book.authors);
    const currentSort = book.author_sort || "";

    // Normalize for comparison (trim whitespace, standardize case)
    const normalizedCurrent = currentSort.toLowerCase().trim();
    const normalizedExpected = expectedSort.toLowerCase().trim();

    return {
      book,
      currentSort,
      expectedSort,
      needsUpdate: normalizedCurrent !== normalizedExpected,
    };
  });
}

export default async function normalizeAuthorSort({
  preview,
  authorId,
  limit,
}: InferSchema<typeof schema>): Promise<string> {
  // Get author name if ID provided
  let authorName: string | undefined;
  if (authorId) {
    const name = await getAuthorName(authorId);
    if (!name) {
      return `Author not found with ID: ${authorId}. Use search_authors_by_name to find valid author IDs.`;
    }
    authorName = name;
  }

  // Get books
  const books = await getBooks(authorName, limit);

  if (books.length === 0) {
    return authorName
      ? `No books found by author: ${authorName}`
      : "No books found in the library.";
  }

  // Analyze books
  const results = analyzeBooks(books);
  const needsUpdate = results.filter((r) => r.needsUpdate);

  if (needsUpdate.length === 0) {
    const lines = [
      "# Author Sort Normalization",
      "",
      `✓ All ${books.length} books have correctly formatted author_sort values.`,
    ];

    if (authorName) {
      lines.push("", `Checked books by: ${authorName}`);
    }

    return lines.join("\n");
  }

  const lines = [
    "# Author Sort Normalization",
    "",
    `**Books scanned:** ${books.length}`,
    `**Need updates:** ${needsUpdate.length}`,
    authorName ? `**Author filter:** ${authorName}` : "",
    "",
  ].filter(Boolean);

  if (preview) {
    lines.push("## Preview of Changes");
    lines.push("");
    lines.push(
      "*This is a preview. Set preview: false to apply these changes.*"
    );
    lines.push("");

    for (const result of needsUpdate) {
      lines.push(`### ID ${result.book.id}: ${result.book.title}`);
      lines.push(`- **Author:** ${result.book.authors}`);
      lines.push(`- **Current sort:** "${result.currentSort}"`);
      lines.push(`- **Expected sort:** "${result.expectedSort}"`);
      lines.push("");
    }

    lines.push("---");
    lines.push("");
    lines.push(
      "To apply these changes, call this tool again with `preview: false`."
    );
    lines.push("");
    lines.push(
      "**Note:** Requires CALIBRE_ENABLE_WRITE_OPERATIONS=true in environment."
    );
  } else {
    // Apply changes
    assertWriteEnabled();

    lines.push("## Applying Changes");
    lines.push("");

    let successCount = 0;
    let errorCount = 0;

    for (const result of needsUpdate) {
      try {
        await runCalibredb([
          "set_metadata",
          String(result.book.id),
          "--field",
          `author_sort:${result.expectedSort}`,
        ]);

        lines.push(
          `✓ **ID ${result.book.id}:** Updated to "${result.expectedSort}"`
        );
        successCount++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        lines.push(`✗ **ID ${result.book.id}:** Failed - ${msg}`);
        errorCount++;
      }
    }

    lines.push("");
    lines.push("## Summary");
    lines.push("");
    lines.push(`- **Successfully updated:** ${successCount}`);
    if (errorCount > 0) {
      lines.push(`- **Failed:** ${errorCount}`);
    }
  }

  return lines.join("\n");
}
