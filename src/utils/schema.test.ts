import { describe, it, expect } from "vitest";
import {
  LIMITS,
  DEFAULTS,
  SORT_FIELDS,
  bookIdSchema,
  limitSchema,
  ascendingSchema,
  exactMatchSchema,
  sortBySchema,
  commonSchemas,
} from "./schema";

describe("LIMITS constants", () => {
  it("has expected values", () => {
    expect(LIMITS.SMALL).toBe(50);
    expect(LIMITS.STANDARD).toBe(100);
    expect(LIMITS.EXCERPT_CHARS).toBe(10000);
    expect(LIMITS.CONTEXT_CHARS).toBe(500);
    expect(LIMITS.MAX_MATCHES).toBe(20);
  });
});

describe("DEFAULTS constants", () => {
  it("has expected values", () => {
    expect(DEFAULTS.SAMPLE_LIMIT).toBe(5);
    expect(DEFAULTS.SEARCH_LIMIT).toBe(25);
    expect(DEFAULTS.LIST_LIMIT).toBe(50);
    expect(DEFAULTS.FTS_LIMIT).toBe(20);
    expect(DEFAULTS.CONTEXT_CHARS).toBe(150);
    expect(DEFAULTS.MAX_MATCHES).toBe(10);
    expect(DEFAULTS.EXCERPT_CHARS).toBe(2000);
  });
});

describe("SORT_FIELDS constants", () => {
  it("has book sort fields", () => {
    expect(SORT_FIELDS.BOOK).toContain("title");
    expect(SORT_FIELDS.BOOK).toContain("authors");
    expect(SORT_FIELDS.BOOK).toContain("rating");
    expect(SORT_FIELDS.BOOK).toContain("pubdate");
  });

  it("has author book sort fields with series", () => {
    expect(SORT_FIELDS.BOOK_BY_AUTHOR).toContain("series");
    expect(SORT_FIELDS.BOOK_BY_AUTHOR).toContain("title");
  });

  it("has author list sort fields", () => {
    expect(SORT_FIELDS.AUTHORS).toContain("name");
    expect(SORT_FIELDS.AUTHORS).toContain("count");
  });
});

describe("bookIdSchema", () => {
  it("validates positive integers", () => {
    const schema = bookIdSchema();
    expect(schema.parse(1)).toBe(1);
    expect(schema.parse(123)).toBe(123);
  });

  it("rejects non-positive values", () => {
    const schema = bookIdSchema();
    expect(() => schema.parse(0)).toThrow();
    expect(() => schema.parse(-1)).toThrow();
  });

  it("rejects non-integers", () => {
    const schema = bookIdSchema();
    expect(() => schema.parse(1.5)).toThrow();
  });

  it("uses custom description", () => {
    const schema = bookIdSchema("Custom description");
    expect(schema.description).toBe("Custom description");
  });
});

describe("limitSchema", () => {
  it("creates schema with default max and default value", () => {
    const schema = limitSchema();
    expect(schema.parse(undefined)).toBe(DEFAULTS.SEARCH_LIMIT);
  });

  it("respects max limit", () => {
    const schema = limitSchema(50);
    expect(() => schema.parse(51)).toThrow();
    expect(schema.parse(50)).toBe(50);
  });

  it("uses custom default", () => {
    const schema = limitSchema(100, 10);
    expect(schema.parse(undefined)).toBe(10);
  });

  it("uses custom description", () => {
    const schema = limitSchema(100, 25, "Custom limit description");
    expect(schema.description).toBe("Custom limit description");
  });

  it("generates description with max and default", () => {
    const schema = limitSchema(50, 20);
    expect(schema.description).toContain("50");
    expect(schema.description).toContain("20");
  });
});

describe("ascendingSchema", () => {
  it("defaults to true", () => {
    const schema = ascendingSchema();
    expect(schema.parse(undefined)).toBe(true);
  });

  it("can default to false", () => {
    const schema = ascendingSchema(false);
    expect(schema.parse(undefined)).toBe(false);
  });

  it("accepts boolean values", () => {
    const schema = ascendingSchema();
    expect(schema.parse(true)).toBe(true);
    expect(schema.parse(false)).toBe(false);
  });
});

describe("exactMatchSchema", () => {
  it("defaults to false (partial match)", () => {
    const schema = exactMatchSchema();
    expect(schema.parse(undefined)).toBe(false);
  });

  it("can default to true (exact match)", () => {
    const schema = exactMatchSchema(true);
    expect(schema.parse(undefined)).toBe(true);
  });

  it("includes field name in description", () => {
    const schema = exactMatchSchema(false, "title");
    expect(schema.description).toContain("title");
  });

  it("accepts boolean values", () => {
    const schema = exactMatchSchema();
    expect(schema.parse(true)).toBe(true);
    expect(schema.parse(false)).toBe(false);
  });
});

describe("sortBySchema", () => {
  it("creates enum from fields array", () => {
    const schema = sortBySchema(["title", "authors", "rating"]);
    expect(schema.parse("title")).toBe("title");
    expect(schema.parse("authors")).toBe("authors");
    expect(schema.parse("rating")).toBe("rating");
  });

  it("rejects invalid values", () => {
    const schema = sortBySchema(["title", "authors"]);
    expect(() => schema.parse("invalid")).toThrow();
  });

  it("uses first field as default", () => {
    const schema = sortBySchema(["title", "authors"]);
    expect(schema.parse(undefined)).toBe("title");
  });

  it("uses custom default", () => {
    const schema = sortBySchema(["title", "authors", "rating"], "rating");
    expect(schema.parse(undefined)).toBe("rating");
  });

  it("includes default in description", () => {
    const schema = sortBySchema(["title", "authors"], "authors");
    expect(schema.description).toContain("authors");
  });
});

describe("commonSchemas", () => {
  describe("bookId", () => {
    it("validates positive integers", () => {
      expect(commonSchemas.bookId.parse(42)).toBe(42);
      expect(() => commonSchemas.bookId.parse(0)).toThrow();
    });
  });

  describe("limit", () => {
    it("has correct default and max", () => {
      expect(commonSchemas.limit.parse(undefined)).toBe(DEFAULTS.SEARCH_LIMIT);
      expect(() => commonSchemas.limit.parse(101)).toThrow();
    });
  });

  describe("sampleLimit", () => {
    it("has smaller max and default", () => {
      expect(commonSchemas.sampleLimit.parse(undefined)).toBe(DEFAULTS.SAMPLE_LIMIT);
      expect(() => commonSchemas.sampleLimit.parse(51)).toThrow();
    });
  });

  describe("ascending", () => {
    it("defaults to true", () => {
      expect(commonSchemas.ascending.parse(undefined)).toBe(true);
    });
  });

  describe("descending", () => {
    it("defaults to false", () => {
      expect(commonSchemas.descending.parse(undefined)).toBe(false);
    });
  });

  describe("exactMatch", () => {
    it("defaults to false", () => {
      expect(commonSchemas.exactMatch.parse(undefined)).toBe(false);
    });
  });

  describe("exactMatchDefault", () => {
    it("defaults to true", () => {
      expect(commonSchemas.exactMatchDefault.parse(undefined)).toBe(true);
    });
  });

  describe("sortByBook", () => {
    it("accepts book sort fields", () => {
      expect(commonSchemas.sortByBook.parse("title")).toBe("title");
      expect(commonSchemas.sortByBook.parse("authors")).toBe("authors");
      expect(commonSchemas.sortByBook.parse("rating")).toBe("rating");
    });

    it("defaults to title", () => {
      expect(commonSchemas.sortByBook.parse(undefined)).toBe("title");
    });
  });

  describe("sortByAuthors", () => {
    it("accepts name and count", () => {
      expect(commonSchemas.sortByAuthors.parse("name")).toBe("name");
      expect(commonSchemas.sortByAuthors.parse("count")).toBe("count");
    });

    it("defaults to count", () => {
      expect(commonSchemas.sortByAuthors.parse(undefined)).toBe("count");
    });
  });

  describe("contextChars", () => {
    it("has correct default and max", () => {
      expect(commonSchemas.contextChars.parse(undefined)).toBe(DEFAULTS.CONTEXT_CHARS);
      expect(() => commonSchemas.contextChars.parse(501)).toThrow();
    });
  });

  describe("maxMatches", () => {
    it("has correct default and max", () => {
      expect(commonSchemas.maxMatches.parse(undefined)).toBe(DEFAULTS.MAX_MATCHES);
      expect(() => commonSchemas.maxMatches.parse(21)).toThrow();
    });
  });

  describe("maxChars", () => {
    it("has correct default and max", () => {
      expect(commonSchemas.maxChars.parse(undefined)).toBe(DEFAULTS.EXCERPT_CHARS);
      expect(() => commonSchemas.maxChars.parse(10001)).toThrow();
    });
  });
});
