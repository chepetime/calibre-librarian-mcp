import { z } from "zod";
import type { InferSchema } from "xmcp";

import { runCalibredb } from "../utils/calibredb";
import { buildListArgs } from "../utils/query";
import { getBookById as getBookByIdUtil } from "../utils/books";

export const schema = {
  mode: z
    .enum(["title", "author_title", "identifier"])
    .default("author_title")
    .describe(
      "Detection mode: 'title' (similar titles), 'author_title' (same author + similar title), 'identifier' (matching ISBN/ASIN)."
    ),
  bookId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Optional: Check for duplicates of a specific book. If not provided, scans entire library."
    ),
  threshold: z
    .number()
    .min(0)
    .max(1)
    .default(0.8)
    .describe(
      "Similarity threshold for title matching (0-1). Higher = stricter matching. Default: 0.8."
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(50)
    .default(20)
    .describe("Maximum number of duplicate groups to return (default: 20)."),
};

export const metadata = {
  name: "find_duplicates",
  description:
    "Find potential duplicate books in the library. Helps identify books that may have been added multiple times with slight variations in metadata. Returns groups of potentially duplicate books for review.",
  annotations: {
    title: "Find duplicates",
    idempotentHint: true,
    readOnlyHint: true,
    destructiveHint: false,
  },
};

interface Book {
  id: number;
  title: string;
  authors: string;
  identifiers?: string;
  formats?: string;
}

interface DuplicateGroup {
  reason: string;
  books: Book[];
}

/**
 * Simple string similarity using Levenshtein-like approach.
 * Returns value between 0 and 1 (1 = identical).
 */
function similarity(s1: string, s2: string): number {
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();

  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;

  // Simple token overlap for efficiency
  const tokens1 = new Set(str1.split(/\s+/));
  const tokens2 = new Set(str2.split(/\s+/));

  const intersection = [...tokens1].filter((t) => tokens2.has(t)).length;
  const union = new Set([...tokens1, ...tokens2]).size;

  return intersection / union;
}

/**
 * Normalize title for comparison (remove subtitles, articles, etc.)
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/\s*[:;]\s*.*/g, "") // Remove subtitles
    .replace(/[^\w\s]/g, "")
    .trim();
}

async function getAllBooks(): Promise<Book[]> {
  const output = await runCalibredb(
    buildListArgs({
      fields: "DUPLICATES",
      forMachine: true,
    })
  );

  if (!output) return [];

  const books = JSON.parse(output);
  return books.map((b: Record<string, unknown>) => ({
    id: b.id as number,
    title: b.title as string,
    authors: b.authors as string,
    identifiers: b.identifiers as string | undefined,
    formats: b.formats as string | undefined,
  }));
}

async function getBookById(bookId: number): Promise<Book | null> {
  return getBookByIdUtil<Book>(bookId, { fields: "DUPLICATES" });
}

function findDuplicatesByTitle(
  books: Book[],
  threshold: number,
  limit: number
): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const processed = new Set<number>();

  for (let i = 0; i < books.length && groups.length < limit; i++) {
    if (processed.has(books[i].id)) continue;

    const normalizedTitle = normalizeTitle(books[i].title);
    const duplicates: Book[] = [books[i]];
    processed.add(books[i].id);

    for (let j = i + 1; j < books.length; j++) {
      if (processed.has(books[j].id)) continue;

      const sim = similarity(normalizedTitle, normalizeTitle(books[j].title));
      if (sim >= threshold) {
        duplicates.push(books[j]);
        processed.add(books[j].id);
      }
    }

    if (duplicates.length > 1) {
      groups.push({
        reason: `Similar titles (${Math.round(threshold * 100)}%+ match)`,
        books: duplicates,
      });
    }
  }

  return groups;
}

function findDuplicatesByAuthorTitle(
  books: Book[],
  threshold: number,
  limit: number
): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const processed = new Set<number>();

  // Group by author first
  const byAuthor = new Map<string, Book[]>();
  for (const book of books) {
    const authorKey = book.authors.toLowerCase().trim();
    if (!byAuthor.has(authorKey)) {
      byAuthor.set(authorKey, []);
    }
    byAuthor.get(authorKey)!.push(book);
  }

  for (const [author, authorBooks] of byAuthor) {
    if (authorBooks.length < 2) continue;

    for (let i = 0; i < authorBooks.length && groups.length < limit; i++) {
      if (processed.has(authorBooks[i].id)) continue;

      const normalizedTitle = normalizeTitle(authorBooks[i].title);
      const duplicates: Book[] = [authorBooks[i]];
      processed.add(authorBooks[i].id);

      for (let j = i + 1; j < authorBooks.length; j++) {
        if (processed.has(authorBooks[j].id)) continue;

        const sim = similarity(normalizedTitle, normalizeTitle(authorBooks[j].title));
        if (sim >= threshold) {
          duplicates.push(authorBooks[j]);
          processed.add(authorBooks[j].id);
        }
      }

      if (duplicates.length > 1) {
        groups.push({
          reason: `Same author "${author}" with similar titles`,
          books: duplicates,
        });
      }
    }
  }

  return groups;
}

function findDuplicatesByIdentifier(books: Book[], limit: number): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const byIdentifier = new Map<string, Book[]>();

  for (const book of books) {
    if (!book.identifiers) continue;

    // Parse identifiers (format: "isbn:123456789, amazon:B00ABC")
    const ids = book.identifiers.split(",").map((id) => id.trim().toLowerCase());

    for (const id of ids) {
      if (!id || id === "null") continue;

      if (!byIdentifier.has(id)) {
        byIdentifier.set(id, []);
      }
      byIdentifier.get(id)!.push(book);
    }
  }

  const processed = new Set<string>();
  for (const [identifier, idBooks] of byIdentifier) {
    if (idBooks.length < 2 || processed.has(identifier)) continue;
    if (groups.length >= limit) break;

    processed.add(identifier);
    groups.push({
      reason: `Matching identifier: ${identifier}`,
      books: idBooks,
    });
  }

  return groups;
}

export default async function findDuplicates({
  mode,
  bookId,
  threshold,
  limit,
}: InferSchema<typeof schema>): Promise<string> {
  let books: Book[];

  if (bookId !== undefined) {
    // Check for duplicates of a specific book
    const targetBook = await getBookById(bookId);
    if (!targetBook) {
      return `Book not found with ID: ${bookId}`;
    }

    // Get all books and find similar ones
    const allBooks = await getAllBooks();

    let duplicates: Book[] = [];

    if (mode === "identifier" && targetBook.identifiers) {
      const targetIds = new Set(
        targetBook.identifiers.split(",").map((id) => id.trim().toLowerCase())
      );

      duplicates = allBooks.filter(
        (b) =>
          b.id !== targetBook.id &&
          b.identifiers &&
          b.identifiers
            .split(",")
            .some((id) => targetIds.has(id.trim().toLowerCase()))
      );
    } else {
      const normalizedTarget = normalizeTitle(targetBook.title);

      duplicates = allBooks.filter((b) => {
        if (b.id === targetBook.id) return false;

        if (mode === "author_title") {
          if (b.authors.toLowerCase() !== targetBook.authors.toLowerCase()) {
            return false;
          }
        }

        return similarity(normalizedTarget, normalizeTitle(b.title)) >= threshold;
      });
    }

    if (duplicates.length === 0) {
      return `No potential duplicates found for "${targetBook.title}" by ${targetBook.authors}`;
    }

    const lines = [
      `# Potential Duplicates of "${targetBook.title}"`,
      "",
      `**Original:** ID ${targetBook.id} - ${targetBook.title} by ${targetBook.authors}`,
      "",
      `**Found ${duplicates.length} potential duplicate(s):**`,
      "",
    ];

    for (const dup of duplicates) {
      lines.push(`- **ID ${dup.id}:** ${dup.title} by ${dup.authors}`);
      if (dup.formats) {
        lines.push(`  Formats: ${dup.formats}`);
      }
    }

    return lines.join("\n");
  }

  // Scan entire library
  books = await getAllBooks();

  if (books.length === 0) {
    return "No books found in the library.";
  }

  let groups: DuplicateGroup[];

  switch (mode) {
    case "title":
      groups = findDuplicatesByTitle(books, threshold, limit);
      break;
    case "author_title":
      groups = findDuplicatesByAuthorTitle(books, threshold, limit);
      break;
    case "identifier":
      groups = findDuplicatesByIdentifier(books, limit);
      break;
  }

  if (groups.length === 0) {
    return `No potential duplicates found using ${mode} detection mode.`;
  }

  const lines = [
    `# Potential Duplicates Found`,
    "",
    `**Detection mode:** ${mode}`,
    `**Books scanned:** ${books.length}`,
    `**Duplicate groups found:** ${groups.length}`,
    "",
  ];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    lines.push(`## Group ${i + 1}: ${group.reason}`);
    lines.push("");

    for (const book of group.books) {
      lines.push(`- **ID ${book.id}:** ${book.title}`);
      lines.push(`  Author: ${book.authors}`);
      if (book.formats) {
        lines.push(`  Formats: ${book.formats}`);
      }
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("Use `get_book_details` to compare books before deciding which to keep.");

  return lines.join("\n");
}
