/**
 * Query building utilities for calibredb commands.
 *
 * Provides helpers to construct Calibre query language expressions
 * and calibredb list command arguments consistently across tools.
 */

/**
 * Calibre fields that can be used in queries.
 */
export type CalibreField =
  | "title"
  | "author"
  | "authors"
  | "tag"
  | "tags"
  | "series"
  | "publisher"
  | "format"
  | "formats"
  | "rating"
  | "id"
  | "identifiers"
  | "pubdate"
  | "timestamp"
  | "size"
  | "comments"
  | "languages";

/**
 * Build a Calibre query language expression for a field search.
 *
 * @param field - The field to search (e.g., 'title', 'author', 'tag')
 * @param value - The value to search for
 * @param exact - If true, performs exact match (=); if false, contains match (~)
 * @returns Calibre query string like `title:"~value"` or `author:"=value"`
 *
 * @example
 * buildFieldQuery('title', 'lord of the rings', false)
 * // Returns: title:"~lord of the rings"
 *
 * buildFieldQuery('author', 'Tolkien', true)
 * // Returns: author:"=Tolkien"
 */
export function buildFieldQuery(
  field: CalibreField | string,
  value: string,
  exact: boolean = false
): string {
  const operator = exact ? "=" : "~";
  return `${field}:"${operator}${value}"`;
}

/**
 * Preset field combinations for common use cases.
 */
export const FIELD_PRESETS = {
  /** Basic book info: id, title, authors, tags, series, formats */
  BASIC: "id,title,authors,tags,series,formats",

  /** Extended info with series index and publication date */
  EXTENDED: "id,title,authors,series,series_index,tags,pubdate,formats",

  /** Full metadata for detailed views and comparisons */
  FULL: "id,title,authors,series,series_index,tags,publisher,pubdate,rating,formats,identifiers,languages,comments",

  /** Minimal info for counts and listings */
  MINIMAL: "id,title,authors",

  /** For duplicate detection */
  DUPLICATES: "id,title,authors,identifiers,formats",

  /** For quality reports */
  QUALITY: "id,title,authors,tags,comments,series,formats,identifiers,publisher,rating,cover",
} as const;

export type FieldPreset = keyof typeof FIELD_PRESETS;

/**
 * Options for building calibredb list command arguments.
 */
export interface ListArgsOptions {
  /**
   * Fields to retrieve. Can be a comma-separated string, an array of field names,
   * or a preset name from FIELD_PRESETS.
   */
  fields: string | string[] | FieldPreset;

  /**
   * Optional search query (Calibre query language).
   */
  search?: string;

  /**
   * Field to sort results by.
   */
  sortBy?: string;

  /**
   * Sort in ascending order (default: true when sortBy is provided).
   */
  ascending?: boolean;

  /**
   * Maximum number of results to return.
   */
  limit?: number;

  /**
   * Output JSON format suitable for machine parsing.
   */
  forMachine?: boolean;
}

/**
 * Resolve fields parameter to a comma-separated string.
 */
function resolveFields(fields: string | string[] | FieldPreset): string {
  // Check if it's a preset name
  if (typeof fields === "string" && fields in FIELD_PRESETS) {
    return FIELD_PRESETS[fields as FieldPreset];
  }

  // If it's an array, join with commas
  if (Array.isArray(fields)) {
    return fields.join(",");
  }

  // Already a comma-separated string
  return fields;
}

/**
 * Build arguments array for `calibredb list` command.
 *
 * @param options - Configuration for the list command
 * @returns Array of arguments to pass to calibredb
 *
 * @example
 * buildListArgs({
 *   fields: 'BASIC',
 *   search: 'author:"~Tolkien"',
 *   sortBy: 'title',
 *   ascending: true,
 *   limit: 25,
 * })
 * // Returns: ['list', '--fields', 'id,title,authors,tags,series,formats',
 * //           '--search', 'author:"~Tolkien"', '--sort-by', 'title',
 * //           '--ascending', '--limit', '25']
 *
 * @example
 * buildListArgs({
 *   fields: ['id', 'title', 'authors'],
 *   forMachine: true,
 * })
 * // Returns: ['list', '--fields', 'id,title,authors', '--for-machine']
 */
export function buildListArgs(options: ListArgsOptions): string[] {
  const { fields, search, sortBy, ascending, limit, forMachine } = options;

  const args: string[] = ["list", "--fields", resolveFields(fields)];

  if (search) {
    args.push("--search", search);
  }

  if (sortBy) {
    args.push("--sort-by", sortBy);
  }

  if (ascending === true) {
    args.push("--ascending");
  }

  if (limit !== undefined) {
    args.push("--limit", String(limit));
  }

  if (forMachine) {
    args.push("--for-machine");
  }

  return args;
}

/**
 * Combine multiple queries with AND operator.
 *
 * @param queries - Array of query strings to combine
 * @returns Combined query string
 *
 * @example
 * combineQueries(['author:"~Tolkien"', 'tag:fantasy'])
 * // Returns: 'author:"~Tolkien" and tag:fantasy'
 */
export function combineQueries(queries: string[]): string {
  return queries.filter(Boolean).join(" and ");
}

/**
 * Build an ID search query.
 *
 * @param bookId - Single book ID or array of book IDs
 * @returns Calibre query for the ID(s)
 *
 * @example
 * buildIdQuery(123)
 * // Returns: 'id:123'
 *
 * buildIdQuery([1, 2, 3])
 * // Returns: 'id:1 or id:2 or id:3'
 */
export function buildIdQuery(bookId: number | number[]): string {
  if (Array.isArray(bookId)) {
    return bookId.map((id) => `id:${id}`).join(" or ");
  }
  return `id:${bookId}`;
}
