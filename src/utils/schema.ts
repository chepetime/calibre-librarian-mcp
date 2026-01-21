/**
 * Shared Zod schema constants and factories for consistent tool parameters.
 *
 * Provides reusable schema definitions to reduce duplication across tools
 * and ensure consistent parameter validation and descriptions.
 */

import { z } from "zod";

/**
 * Standard limit values used across tools.
 */
export const LIMITS = {
  /** Small result sets (sample lists, duplicates) */
  SMALL: 50,
  /** Standard result sets (searches, listings) */
  STANDARD: 100,
  /** Maximum characters for excerpts */
  EXCERPT_CHARS: 10000,
  /** Maximum context characters for search snippets */
  CONTEXT_CHARS: 500,
  /** Maximum matches for content search */
  MAX_MATCHES: 20,
} as const;

/**
 * Default values for common parameters.
 */
export const DEFAULTS = {
  /** Default limit for sample lists */
  SAMPLE_LIMIT: 5,
  /** Default limit for search results */
  SEARCH_LIMIT: 25,
  /** Default limit for full listings */
  LIST_LIMIT: 50,
  /** Default limit for FTS results */
  FTS_LIMIT: 20,
  /** Default context characters for search */
  CONTEXT_CHARS: 150,
  /** Default max matches for content search */
  MAX_MATCHES: 10,
  /** Default excerpt length */
  EXCERPT_CHARS: 2000,
} as const;

/**
 * Common sortBy field options.
 */
export const SORT_FIELDS = {
  /** Standard book sorting fields */
  BOOK: ["title", "authors", "rating", "timestamp", "pubdate", "size", "id"] as const,
  /** Author-specific sorting fields (includes series) */
  BOOK_BY_AUTHOR: ["title", "pubdate", "timestamp", "series", "rating"] as const,
  /** Tag/category book sorting fields */
  BOOK_BY_TAG: ["title", "authors", "pubdate", "timestamp", "rating"] as const,
  /** Author list sorting */
  AUTHORS: ["name", "count"] as const,
  /** Tag list sorting */
  TAGS: ["name", "count"] as const,
} as const;

// ============================================================================
// Schema Factories
// ============================================================================

/**
 * Create a book ID schema.
 *
 * @param description - Custom description (default: "Calibre book ID")
 * @returns Zod schema for book ID
 */
export function bookIdSchema(description = "Calibre book ID.") {
  return z.number().int().positive().describe(description);
}

/**
 * Create a limit schema with configurable max and default.
 *
 * @param max - Maximum allowed value
 * @param defaultValue - Default value
 * @param description - Optional custom description
 * @returns Zod schema for limit parameter
 */
export function limitSchema(
  max: number = LIMITS.STANDARD,
  defaultValue: number = DEFAULTS.SEARCH_LIMIT,
  description?: string
) {
  const desc = description || `Maximum number of results to return (default: ${defaultValue}, max: ${max}).`;
  return z.number().int().positive().max(max).default(defaultValue).describe(desc);
}

/**
 * Create an ascending sort order schema.
 *
 * @param defaultValue - Default sort order (default: true = ascending)
 * @returns Zod schema for ascending parameter
 */
export function ascendingSchema(defaultValue = true) {
  return z
    .boolean()
    .default(defaultValue)
    .describe(`Sort in ${defaultValue ? "ascending" : "descending"} order (default: ${defaultValue}).`);
}

/**
 * Create an exact match schema.
 *
 * @param defaultExact - Whether exact match is default (default: false = partial match)
 * @param fieldName - Name of the field being matched (for description)
 * @returns Zod schema for exact parameter
 */
export function exactMatchSchema(defaultExact = false, fieldName = "value") {
  const exactDesc = `match the exact ${fieldName}`;
  const partialDesc = `perform a partial/contains search`;

  return z
    .boolean()
    .default(defaultExact)
    .describe(
      defaultExact
        ? `If true (default), ${exactDesc}. If false, ${partialDesc}.`
        : `If true, ${exactDesc}. If false (default), ${partialDesc}.`
    );
}

/**
 * Create a sortBy schema for book fields.
 *
 * @param fields - Array of allowed sort fields
 * @param defaultField - Default sort field
 * @returns Zod schema for sortBy parameter
 */
export function sortBySchema<T extends readonly string[]>(
  fields: T,
  defaultField: T[number] = "title"
) {
  return z
    .enum(fields as unknown as [string, ...string[]])
    .default(defaultField)
    .describe(`Field to sort results by (default: ${defaultField}).`);
}

// ============================================================================
// Pre-built Common Schemas
// ============================================================================

/**
 * Common schemas ready to use in tool definitions.
 */
export const commonSchemas = {
  /** Standard book ID parameter */
  bookId: bookIdSchema(),

  /** Book ID for update operations */
  bookIdForUpdate: bookIdSchema("Calibre book ID to update."),

  /** Book ID for search operations */
  bookIdForSearch: bookIdSchema("Calibre book ID to search within."),

  /** Standard limit (max: 100, default: 25) */
  limit: limitSchema(LIMITS.STANDARD, DEFAULTS.SEARCH_LIMIT),

  /** Small limit for samples (max: 50, default: 5) */
  sampleLimit: limitSchema(LIMITS.SMALL, DEFAULTS.SAMPLE_LIMIT),

  /** List limit (max: 100, default: 50) */
  listLimit: limitSchema(LIMITS.STANDARD, DEFAULTS.LIST_LIMIT),

  /** FTS limit (max: 50, default: 20) */
  ftsLimit: limitSchema(LIMITS.SMALL, DEFAULTS.FTS_LIMIT),

  /** Standard ascending sort flag */
  ascending: ascendingSchema(true),

  /** Descending sort flag */
  descending: ascendingSchema(false),

  /** Exact match flag (default: false = partial) */
  exactMatch: exactMatchSchema(false),

  /** Exact match flag (default: true = exact) */
  exactMatchDefault: exactMatchSchema(true),

  /** Standard book sortBy */
  sortByBook: sortBySchema(SORT_FIELDS.BOOK, "title"),

  /** Author books sortBy */
  sortByAuthorBooks: sortBySchema(SORT_FIELDS.BOOK_BY_AUTHOR, "title"),

  /** Tag books sortBy */
  sortByTagBooks: sortBySchema(SORT_FIELDS.BOOK_BY_TAG, "title"),

  /** Author list sortBy */
  sortByAuthors: sortBySchema(SORT_FIELDS.AUTHORS, "count"),

  /** Tag list sortBy */
  sortByTags: sortBySchema(SORT_FIELDS.TAGS, "count"),

  /** Context characters for search snippets */
  contextChars: z
    .number()
    .int()
    .positive()
    .max(LIMITS.CONTEXT_CHARS)
    .default(DEFAULTS.CONTEXT_CHARS)
    .describe(`Characters of context to show around each match (default: ${DEFAULTS.CONTEXT_CHARS}).`),

  /** Max matches for content search */
  maxMatches: z
    .number()
    .int()
    .positive()
    .max(LIMITS.MAX_MATCHES)
    .default(DEFAULTS.MAX_MATCHES)
    .describe(`Maximum number of matches to return (default: ${DEFAULTS.MAX_MATCHES}, max: ${LIMITS.MAX_MATCHES}).`),

  /** Max characters for excerpts */
  maxChars: z
    .number()
    .int()
    .positive()
    .max(LIMITS.EXCERPT_CHARS)
    .default(DEFAULTS.EXCERPT_CHARS)
    .describe(`Maximum characters to return (default: ${DEFAULTS.EXCERPT_CHARS}, max: ${LIMITS.EXCERPT_CHARS}).`),
} as const;
