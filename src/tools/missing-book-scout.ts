import { z } from "zod";
import type { InferSchema } from "xmcp";

import { runCalibredb } from "../utils/calibredb";
import { config } from "../config";

export const schema = {
  readingList: z
    .string()
    .min(1)
    .describe(
      "Reading list to check. One book per line. Format: 'Title' or 'Title by Author'. Example:\nThe Hobbit by J.R.R. Tolkien\nDune\n1984 by George Orwell"
    ),
  searchEngine: z
    .enum(["default", "annas_archive", "goodreads", "amazon", "libgen"])
    .default("default")
    .describe(
      "Search engine for missing books: 'default' (uses FAVORITE_SEARCH_ENGINE_URL), 'annas_archive', 'goodreads', 'amazon', 'libgen'."
    ),
  fuzzyMatch: z
    .boolean()
    .default(true)
    .describe(
      "If true (default), use fuzzy title matching. If false, require exact title match."
    ),
};

export const metadata = {
  name: "missing_book_scout",
  description:
    "Check a reading list against your Calibre library. Reports which books you own and generates search links for missing titles. Great for processing 'to-read' lists or book recommendations.",
  annotations: {
    title: "Missing book scout",
    idempotentHint: true,
    readOnlyHint: true,
    destructiveHint: false,
  },
};

interface BookEntry {
  title: string;
  author?: string;
  originalLine: string;
}

interface LibraryBook {
  id: number;
  title: string;
  authors: string;
}

interface MatchResult {
  entry: BookEntry;
  found: boolean;
  matches?: LibraryBook[];
  searchUrl?: string;
}

const SEARCH_ENGINES: Record<string, string> = {
  annas_archive: "https://annas-archive.org/search?q=",
  goodreads: "https://www.goodreads.com/search?q=",
  amazon: "https://www.amazon.com/s?k=",
  libgen: "https://libgen.is/search.php?req=",
};

function parseReadingList(text: string): BookEntry[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  return lines.map((line) => {
    // Try to parse "Title by Author" format
    const byMatch = line.match(/^(.+?)\s+by\s+(.+)$/i);

    if (byMatch) {
      return {
        title: byMatch[1].trim(),
        author: byMatch[2].trim(),
        originalLine: line,
      };
    }

    // Try "Author - Title" format
    const dashMatch = line.match(/^(.+?)\s*[-–—]\s*(.+)$/);
    if (dashMatch) {
      // Could be "Author - Title" or "Title - Subtitle"
      // Assume it's "Title - Subtitle" unless first part looks like a name
      return {
        title: line, // Keep full line as title
        originalLine: line,
      };
    }

    return {
      title: line,
      originalLine: line,
    };
  });
}

async function getLibraryBooks(): Promise<LibraryBook[]> {
  const output = await runCalibredb([
    "list",
    "--fields",
    "id,title,authors",
    "--for-machine",
  ]);

  if (!output) return [];

  const books = JSON.parse(output);
  return books.map((b: Record<string, unknown>) => ({
    id: b.id as number,
    title: b.title as string,
    authors: b.authors as string,
  }));
}

function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/^(the|a|an)\s+/i, "") // Remove leading articles
    .trim();
}

function findMatches(
  entry: BookEntry,
  libraryBooks: LibraryBook[],
  fuzzy: boolean
): LibraryBook[] {
  const normalizedTitle = normalizeForComparison(entry.title);
  const normalizedAuthor = entry.author
    ? normalizeForComparison(entry.author)
    : null;

  return libraryBooks.filter((book) => {
    const bookTitle = normalizeForComparison(book.title);
    const bookAuthors = normalizeForComparison(book.authors);

    let titleMatch: boolean;

    if (fuzzy) {
      // Fuzzy: check if one contains the other
      titleMatch =
        bookTitle.includes(normalizedTitle) ||
        normalizedTitle.includes(bookTitle);
    } else {
      // Exact match
      titleMatch = bookTitle === normalizedTitle;
    }

    if (!titleMatch) return false;

    // If author specified, check author too
    if (normalizedAuthor) {
      const authorMatch =
        bookAuthors.includes(normalizedAuthor) ||
        normalizedAuthor.includes(bookAuthors);
      return authorMatch;
    }

    return true;
  });
}

function generateSearchUrl(entry: BookEntry, searchEngine: string): string {
  let baseUrl: string;

  if (searchEngine === "default") {
    baseUrl = config.favoriteSearchEngineUrl;
  } else {
    baseUrl = SEARCH_ENGINES[searchEngine] || config.favoriteSearchEngineUrl;
  }

  const query = entry.author
    ? `${entry.title} ${entry.author}`
    : entry.title;

  return baseUrl + encodeURIComponent(query);
}

export default async function missingBookScout({
  readingList,
  searchEngine,
  fuzzyMatch,
}: InferSchema<typeof schema>): Promise<string> {
  // Parse reading list
  const entries = parseReadingList(readingList);

  if (entries.length === 0) {
    return "No books found in the reading list. Please provide one book per line.";
  }

  // Get library books
  const libraryBooks = await getLibraryBooks();

  if (libraryBooks.length === 0) {
    return "Could not retrieve books from the library.";
  }

  // Check each entry
  const results: MatchResult[] = entries.map((entry) => {
    const matches = findMatches(entry, libraryBooks, fuzzyMatch);

    if (matches.length > 0) {
      return { entry, found: true, matches };
    } else {
      return {
        entry,
        found: false,
        searchUrl: generateSearchUrl(entry, searchEngine),
      };
    }
  });

  const found = results.filter((r) => r.found);
  const missing = results.filter((r) => !r.found);

  // Build output
  const lines = [
    "# Reading List Check",
    "",
    `**Books checked:** ${entries.length}`,
    `**Found in library:** ${found.length}`,
    `**Missing:** ${missing.length}`,
    "",
  ];

  if (found.length > 0) {
    lines.push("## ✓ Books You Own");
    lines.push("");

    for (const result of found) {
      const match = result.matches![0];
      lines.push(`- **${result.entry.originalLine}**`);
      lines.push(`  → Found: "${match.title}" by ${match.authors} (ID: ${match.id})`);
    }

    lines.push("");
  }

  if (missing.length > 0) {
    lines.push("## ✗ Missing Books");
    lines.push("");

    const engineName =
      searchEngine === "default"
        ? "configured search engine"
        : searchEngine.replace("_", " ");

    lines.push(`*Click links to search on ${engineName}*`);
    lines.push("");

    for (const result of missing) {
      lines.push(`- **${result.entry.originalLine}**`);
      lines.push(`  → [Search](${result.searchUrl})`);
    }

    lines.push("");
  }

  // Summary
  if (missing.length === 0) {
    lines.push("---");
    lines.push("");
    lines.push("🎉 You already own all the books on this list!");
  } else if (found.length === 0) {
    lines.push("---");
    lines.push("");
    lines.push(
      "None of these books are in your library yet. Click the search links to find them."
    );
  } else {
    lines.push("---");
    lines.push("");
    lines.push(
      `You own ${Math.round((found.length / entries.length) * 100)}% of this reading list.`
    );
  }

  return lines.join("\n");
}
