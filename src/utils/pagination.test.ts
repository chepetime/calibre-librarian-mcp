import { describe, it, expect } from "vitest";
import {
  PAGINATION_DEFAULTS,
  paginate,
  formatPaginationInfo,
  getPaginationHint,
  getCalibredbLimit,
  type PaginationMeta,
} from "./pagination";

describe("PAGINATION_DEFAULTS", () => {
  it("should have expected default values", () => {
    expect(PAGINATION_DEFAULTS.limit).toBe(25);
    expect(PAGINATION_DEFAULTS.maxLimit).toBe(100);
    expect(PAGINATION_DEFAULTS.offset).toBe(0);
  });
});

describe("paginate", () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it("should return first page of items", () => {
    const result = paginate(items, { limit: 3, offset: 0 });

    expect(result.items).toEqual([1, 2, 3]);
    expect(result.pagination.returnedCount).toBe(3);
    expect(result.pagination.totalCount).toBe(10);
    expect(result.pagination.hasMore).toBe(true);
    expect(result.pagination.nextOffset).toBe(3);
  });

  it("should return middle page of items", () => {
    const result = paginate(items, { limit: 3, offset: 3 });

    expect(result.items).toEqual([4, 5, 6]);
    expect(result.pagination.offset).toBe(3);
    expect(result.pagination.hasMore).toBe(true);
    expect(result.pagination.nextOffset).toBe(6);
  });

  it("should return last page of items", () => {
    const result = paginate(items, { limit: 3, offset: 9 });

    expect(result.items).toEqual([10]);
    expect(result.pagination.returnedCount).toBe(1);
    expect(result.pagination.hasMore).toBe(false);
    expect(result.pagination.nextOffset).toBeUndefined();
  });

  it("should handle exact page boundary", () => {
    const result = paginate(items, { limit: 5, offset: 5 });

    expect(result.items).toEqual([6, 7, 8, 9, 10]);
    expect(result.pagination.hasMore).toBe(false);
  });

  it("should handle offset beyond items", () => {
    const result = paginate(items, { limit: 3, offset: 20 });

    expect(result.items).toEqual([]);
    expect(result.pagination.returnedCount).toBe(0);
    expect(result.pagination.hasMore).toBe(false);
  });

  it("should handle empty array", () => {
    const result = paginate([], { limit: 10, offset: 0 });

    expect(result.items).toEqual([]);
    expect(result.pagination.totalCount).toBe(0);
    expect(result.pagination.hasMore).toBe(false);
  });

  it("should handle limit larger than array", () => {
    const result = paginate(items, { limit: 100, offset: 0 });

    expect(result.items).toEqual(items);
    expect(result.pagination.returnedCount).toBe(10);
    expect(result.pagination.hasMore).toBe(false);
  });

  it("should preserve item types", () => {
    const objects = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = paginate(objects, { limit: 2, offset: 0 });

    expect(result.items).toEqual([{ id: 1 }, { id: 2 }]);
  });
});

describe("formatPaginationInfo", () => {
  it("should format first page with total", () => {
    const meta: PaginationMeta = {
      limit: 25,
      offset: 0,
      returnedCount: 25,
      totalCount: 100,
      hasMore: true,
      nextOffset: 25,
    };

    expect(formatPaginationInfo(meta)).toBe("Showing 1-25 of 100 results");
  });

  it("should format middle page with total", () => {
    const meta: PaginationMeta = {
      limit: 25,
      offset: 50,
      returnedCount: 25,
      totalCount: 100,
      hasMore: true,
      nextOffset: 75,
    };

    expect(formatPaginationInfo(meta)).toBe("Showing 51-75 of 100 results");
  });

  it("should format last page with total", () => {
    const meta: PaginationMeta = {
      limit: 25,
      offset: 75,
      returnedCount: 25,
      totalCount: 100,
      hasMore: false,
    };

    expect(formatPaginationInfo(meta)).toBe("Showing 76-100 of 100 results");
  });

  it("should handle showing all results", () => {
    const meta: PaginationMeta = {
      limit: 100,
      offset: 0,
      returnedCount: 42,
      totalCount: 42,
      hasMore: false,
    };

    expect(formatPaginationInfo(meta)).toBe("Showing all 42 results");
  });

  it("should handle single result", () => {
    const meta: PaginationMeta = {
      limit: 25,
      offset: 0,
      returnedCount: 1,
      totalCount: 1,
      hasMore: false,
    };

    expect(formatPaginationInfo(meta)).toBe("Showing all 1 result");
  });

  it("should handle no results with total", () => {
    const meta: PaginationMeta = {
      limit: 25,
      offset: 0,
      returnedCount: 0,
      totalCount: 0,
      hasMore: false,
    };

    expect(formatPaginationInfo(meta)).toBe("No results found");
  });

  it("should handle no results without total", () => {
    const meta: PaginationMeta = {
      limit: 25,
      offset: 0,
      returnedCount: 0,
      hasMore: false,
    };

    expect(formatPaginationInfo(meta)).toBe("No results found");
  });

  it("should format without total when hasMore is true", () => {
    const meta: PaginationMeta = {
      limit: 25,
      offset: 0,
      returnedCount: 25,
      hasMore: true,
      nextOffset: 25,
    };

    expect(formatPaginationInfo(meta)).toBe(
      "Showing 1-25 (more available, use offset: 25)"
    );
  });

  it("should format without total when hasMore is false", () => {
    const meta: PaginationMeta = {
      limit: 25,
      offset: 0,
      returnedCount: 10,
      hasMore: false,
    };

    expect(formatPaginationInfo(meta)).toBe("Showing 1-10");
  });
});

describe("getPaginationHint", () => {
  it("should return hint when more results available", () => {
    const meta: PaginationMeta = {
      limit: 25,
      offset: 0,
      returnedCount: 25,
      hasMore: true,
      nextOffset: 25,
    };

    expect(getPaginationHint(meta)).toBe(
      "To see more results, use offset: 25 (limit: 25)"
    );
  });

  it("should return null when no more results", () => {
    const meta: PaginationMeta = {
      limit: 25,
      offset: 0,
      returnedCount: 10,
      hasMore: false,
    };

    expect(getPaginationHint(meta)).toBeNull();
  });
});

describe("getCalibredbLimit", () => {
  it("should add offset to limit", () => {
    expect(getCalibredbLimit({ limit: 25, offset: 0 })).toBe(25);
    expect(getCalibredbLimit({ limit: 25, offset: 50 })).toBe(75);
    expect(getCalibredbLimit({ limit: 10, offset: 100 })).toBe(110);
  });
});
