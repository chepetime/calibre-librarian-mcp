/**
 * Response formatting utilities for consistent tool output.
 *
 * Provides structured responses that include both machine-readable data
 * and human-friendly summaries.
 */

export interface ToolResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  summary: string;
  metadata?: {
    totalCount?: number;
    returnedCount?: number;
    hasMore?: boolean;
    query?: string;
    [key: string]: unknown;
  };
}

export interface BookResult {
  id: number;
  title: string;
  authors: string;
  series?: string;
  seriesIndex?: number;
  tags?: string[];
  formats?: string[];
  pubdate?: string;
  rating?: number;
}

export interface AuthorResult {
  id: number;
  name: string;
  bookCount: number;
}

export interface TagResult {
  name: string;
  bookCount: number;
}

/**
 * Format a successful response with structured data.
 */
export function formatSuccess<T>(
  data: T,
  summary: string,
  metadata?: ToolResponse<T>["metadata"]
): string {
  const response: ToolResponse<T> = {
    success: true,
    data,
    summary,
    metadata,
  };

  // Return as formatted JSON block followed by human-readable summary
  return [
    "```json",
    JSON.stringify(response, null, 2),
    "```",
    "",
    summary,
  ].join("\n");
}

/**
 * Format an error response.
 */
export function formatError(error: string, details?: string): string {
  const response: ToolResponse = {
    success: false,
    error,
    summary: details ? `${error}\n\n${details}` : error,
  };

  return [
    "```json",
    JSON.stringify(response, null, 2),
    "```",
    "",
    response.summary,
  ].join("\n");
}

/**
 * Format a list of books with consistent structure.
 */
export function formatBookList(
  books: BookResult[],
  title: string,
  metadata?: ToolResponse<BookResult[]>["metadata"]
): string {
  if (books.length === 0) {
    return formatError("No books found", metadata?.query ? `Query: ${metadata.query}` : undefined);
  }

  const summary = [
    `# ${title}`,
    "",
    `Found ${books.length} book${books.length === 1 ? "" : "s"}${metadata?.hasMore ? " (more available)" : ""}`,
    "",
  ];

  for (const book of books) {
    const parts = [`- **${book.title}**`];
    if (book.authors) parts.push(`by ${book.authors}`);
    if (book.series) {
      parts.push(`(${book.series}${book.seriesIndex ? ` #${book.seriesIndex}` : ""})`);
    }
    summary.push(parts.join(" "));
  }

  return formatSuccess(books, summary.join("\n"), metadata);
}

/**
 * Format a list of authors with consistent structure.
 */
export function formatAuthorList(
  authors: AuthorResult[],
  title: string,
  metadata?: ToolResponse<AuthorResult[]>["metadata"]
): string {
  if (authors.length === 0) {
    return formatError("No authors found", metadata?.query ? `Query: ${metadata.query}` : undefined);
  }

  const summary = [
    `# ${title}`,
    "",
    `Found ${authors.length} author${authors.length === 1 ? "" : "s"}`,
    "",
  ];

  for (const author of authors) {
    summary.push(`- **${author.name}** (ID: ${author.id}): ${author.bookCount} book${author.bookCount === 1 ? "" : "s"}`);
  }

  return formatSuccess(authors, summary.join("\n"), metadata);
}

/**
 * Format a list of tags with consistent structure.
 */
export function formatTagList(
  tags: TagResult[],
  title: string,
  metadata?: ToolResponse<TagResult[]>["metadata"]
): string {
  if (tags.length === 0) {
    return formatError("No tags found", metadata?.query ? `Query: ${metadata.query}` : undefined);
  }

  const summary = [
    `# ${title}`,
    "",
    `Found ${tags.length} tag${tags.length === 1 ? "" : "s"}`,
    "",
  ];

  for (const tag of tags) {
    summary.push(`- **${tag.name}**: ${tag.bookCount} book${tag.bookCount === 1 ? "" : "s"}`);
  }

  return formatSuccess(tags, summary.join("\n"), metadata);
}

/**
 * Parse calibredb list output (--for-machine JSON format) into BookResult array.
 */
export function parseCalibreBookList(jsonOutput: string): BookResult[] {
  try {
    const books = JSON.parse(jsonOutput);
    if (!Array.isArray(books)) return [];

    return books.map((book) => ({
      id: book.id,
      title: book.title || "Unknown",
      authors: book.authors || "Unknown",
      series: book.series || undefined,
      seriesIndex: book.series_index || undefined,
      tags: book.tags ? book.tags.split(", ") : undefined,
      formats: book.formats
        ? book.formats.split(", ").map((f: string) => f.split(".").pop()?.toUpperCase())
        : undefined,
      pubdate: book.pubdate || undefined,
      rating: book.rating || undefined,
    }));
  } catch {
    return [];
  }
}
