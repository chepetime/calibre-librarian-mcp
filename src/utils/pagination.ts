/**
 * Pagination utilities for handling large result sets.
 *
 * Provides consistent pagination schema, helpers, and metadata
 * for tools that return lists of items.
 */

import { z } from "zod";

/**
 * Default pagination values.
 */
export const PAGINATION_DEFAULTS = {
  limit: 25,
  maxLimit: 100,
  offset: 0,
} as const;

/**
 * Zod schema for pagination parameters.
 * Tools can spread this into their own schemas.
 *
 * @example
 * export const schema = {
 *   query: z.string(),
 *   ...paginationSchema,
 * };
 */
export const paginationSchema = {
  limit: z
    .number()
    .int()
    .positive()
    .max(PAGINATION_DEFAULTS.maxLimit)
    .default(PAGINATION_DEFAULTS.limit)
    .describe(
      `Maximum number of results to return (default: ${PAGINATION_DEFAULTS.limit}, max: ${PAGINATION_DEFAULTS.maxLimit}).`
    ),
  offset: z
    .number()
    .int()
    .min(0)
    .default(PAGINATION_DEFAULTS.offset)
    .describe(
      "Number of results to skip for pagination (default: 0). Use with limit for paging through results."
    ),
};

/**
 * Pagination parameters type.
 */
export interface PaginationParams {
  limit: number;
  offset: number;
}

/**
 * Pagination metadata included in responses.
 */
export interface PaginationMeta {
  limit: number;
  offset: number;
  returnedCount: number;
  totalCount?: number;
  hasMore: boolean;
  nextOffset?: number;
}

/**
 * Result of paginating an array.
 */
export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

/**
 * Apply pagination to an array of items.
 *
 * @param items - Full array of items
 * @param params - Pagination parameters (limit, offset)
 * @returns Paginated subset with metadata
 *
 * @example
 * const allBooks = await getAllBooks();
 * const { items, pagination } = paginate(allBooks, { limit: 25, offset: 0 });
 */
export function paginate<T>(
  items: T[],
  params: PaginationParams
): PaginatedResult<T> {
  const { limit, offset } = params;
  const totalCount = items.length;

  const paginatedItems = items.slice(offset, offset + limit);
  const returnedCount = paginatedItems.length;
  const hasMore = offset + returnedCount < totalCount;

  return {
    items: paginatedItems,
    pagination: {
      limit,
      offset,
      returnedCount,
      totalCount,
      hasMore,
      nextOffset: hasMore ? offset + limit : undefined,
    },
  };
}

/**
 * Format pagination info as human-readable string.
 *
 * @example
 * formatPaginationInfo({ limit: 25, offset: 0, returnedCount: 25, totalCount: 100, hasMore: true })
 * // "Showing 1-25 of 100 results"
 */
export function formatPaginationInfo(meta: PaginationMeta): string {
  const start = meta.offset + 1;
  const end = meta.offset + meta.returnedCount;

  if (meta.totalCount !== undefined) {
    if (meta.returnedCount === 0) {
      return "No results found";
    }
    if (meta.totalCount === meta.returnedCount && meta.offset === 0) {
      return `Showing all ${meta.totalCount} result${meta.totalCount === 1 ? "" : "s"}`;
    }
    return `Showing ${start}-${end} of ${meta.totalCount} result${meta.totalCount === 1 ? "" : "s"}`;
  }

  if (meta.returnedCount === 0) {
    return "No results found";
  }

  if (meta.hasMore) {
    return `Showing ${start}-${end} (more available, use offset: ${meta.nextOffset})`;
  }

  return `Showing ${start}-${end}`;
}

/**
 * Generate pagination hint for tool responses.
 */
export function getPaginationHint(meta: PaginationMeta): string | null {
  if (!meta.hasMore) return null;

  return `To see more results, use offset: ${meta.nextOffset} (limit: ${meta.limit})`;
}

/**
 * Build calibredb --limit argument.
 * Note: calibredb doesn't support offset, so we fetch limit+offset and slice.
 */
export function getCalibredbLimit(params: PaginationParams): number {
  return params.limit + params.offset;
}
