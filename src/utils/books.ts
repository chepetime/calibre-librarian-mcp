/**
 * Book fetching utilities for calibredb operations.
 *
 * Provides generic helpers to fetch books by ID with configurable fields,
 * reducing duplication across tools that need to retrieve book metadata.
 */

import { runCalibredb } from "./calibredb";
import { buildListArgs, buildIdQuery, type FieldPreset } from "./query";

/**
 * Basic book information returned by bookExists().
 */
export interface BasicBookInfo {
  id: number;
  title: string;
  authors?: string;
}

/**
 * Book info with format paths, used by content extraction tools.
 */
export interface BookWithFormats {
  id: number;
  title: string;
  authors: string;
  formats: string[];
}

/**
 * Options for fetching books by ID.
 */
export interface GetBookOptions {
  /**
   * Fields to retrieve. Can be a comma-separated string, array, or preset name.
   * Defaults to "id,title,authors".
   */
  fields?: string | string[] | FieldPreset;
}

/**
 * Result from getBooksByIds with tracking of not-found IDs.
 */
export interface GetBooksResult<T> {
  books: T[];
  notFound: number[];
}

/**
 * Parse the calibredb JSON output into an array of books.
 */
function parseBookList<T>(output: string | null): T[] {
  if (!output) return [];

  try {
    const books = JSON.parse(output);
    if (!Array.isArray(books)) return [];
    return books as T[];
  } catch {
    return [];
  }
}

/**
 * Fetch a single book by ID.
 *
 * @param bookId - The Calibre book ID
 * @param options - Configuration options including fields to retrieve
 * @returns The book object or null if not found
 *
 * @example
 * // Basic usage with default fields
 * const book = await getBookById(123);
 * if (book) console.log(book.title);
 *
 * @example
 * // With specific fields
 * const book = await getBookById<MyBookType>(123, {
 *   fields: "id,title,authors,tags,formats"
 * });
 *
 * @example
 * // Using a field preset
 * const book = await getBookById(123, { fields: "FULL" });
 */
export async function getBookById<T = BasicBookInfo>(
  bookId: number,
  options: GetBookOptions = {}
): Promise<T | null> {
  const { fields = "id,title,authors" } = options;

  try {
    const args = buildListArgs({
      fields,
      search: buildIdQuery(bookId),
      forMachine: true,
    });

    const output = await runCalibredb(args);
    const books = parseBookList<T>(output);

    return books.length > 0 ? books[0] : null;
  } catch {
    return null;
  }
}

/**
 * Fetch multiple books by their IDs.
 *
 * @param bookIds - Array of Calibre book IDs
 * @param options - Configuration options including fields to retrieve
 * @returns Object with found books and list of not-found IDs
 *
 * @example
 * const { books, notFound } = await getBooksByIds([1, 2, 3]);
 * if (notFound.length > 0) {
 *   console.log(`Books not found: ${notFound.join(", ")}`);
 * }
 *
 * @example
 * // With specific fields
 * const { books } = await getBooksByIds<BookMetadata>([1, 2, 3], {
 *   fields: "FULL"
 * });
 */
export async function getBooksByIds<T = BasicBookInfo>(
  bookIds: number[],
  options: GetBookOptions = {}
): Promise<GetBooksResult<T>> {
  const { fields = "id,title,authors" } = options;
  const books: T[] = [];
  const notFound: number[] = [];

  // Fetch books in parallel for better performance
  const results = await Promise.all(
    bookIds.map(async (id) => {
      const book = await getBookById<T>(id, { fields });
      return { id, book };
    })
  );

  for (const { id, book } of results) {
    if (book) {
      books.push(book);
    } else {
      notFound.push(id);
    }
  }

  return { books, notFound };
}

/**
 * Check if a book exists and return basic info.
 *
 * @param bookId - The Calibre book ID
 * @returns Basic book info or null if not found
 *
 * @example
 * const book = await bookExists(123);
 * if (!book) {
 *   return `Book not found with ID: 123`;
 * }
 * console.log(`Found: ${book.title}`);
 */
export async function bookExists(bookId: number): Promise<BasicBookInfo | null> {
  return getBookById<BasicBookInfo>(bookId, { fields: "id,title,authors" });
}

/**
 * Get book info with format file paths.
 * Useful for tools that need to access book files (excerpt extraction, content search).
 *
 * @param bookId - The Calibre book ID
 * @returns Book info with format paths or null if not found
 *
 * @example
 * const book = await getBookWithFormats(123);
 * if (book && book.formats.length > 0) {
 *   const epubPath = book.formats.find(f => f.endsWith('.epub'));
 * }
 */
export async function getBookWithFormats(
  bookId: number
): Promise<BookWithFormats | null> {
  const book = await getBookById<{
    id: number;
    title: string;
    authors: string;
    formats?: string;
  }>(bookId, { fields: "id,title,authors,formats" });

  if (!book) return null;

  // Calibre returns formats as comma-separated paths
  const formatPaths = book.formats ? book.formats.split(", ") : [];

  return {
    id: book.id,
    title: book.title,
    authors: book.authors,
    formats: formatPaths,
  };
}

/**
 * Get the title of a book by ID, with a fallback default.
 * Useful for logging and error messages.
 *
 * @param bookId - The Calibre book ID
 * @param fallback - Fallback string if book not found (default: "Book ID {id}")
 * @returns The book title or fallback string
 *
 * @example
 * const title = await getBookTitle(123);
 * console.log(`Processing: ${title}`);
 */
export async function getBookTitle(
  bookId: number,
  fallback?: string
): Promise<string> {
  const book = await getBookById(bookId, { fields: "id,title" });
  return book?.title || fallback || `Book ID ${bookId}`;
}
