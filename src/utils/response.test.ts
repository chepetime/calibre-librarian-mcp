import { describe, it, expect } from "vitest";
import {
  formatSuccess,
  formatError,
  formatBookList,
  formatAuthorList,
  formatTagList,
  parseCalibreBookList,
  formatNoResults,
  formatNoBooksFound,
  formatNoAuthorsFound,
  formatNoTagsFound,
  type BookResult,
  type AuthorResult,
  type TagResult,
} from "./response";

describe("formatSuccess", () => {
  it("should format successful response with data", () => {
    const result = formatSuccess({ count: 42 }, "Found 42 items");

    expect(result).toContain("```json");
    expect(result).toContain('"success": true');
    expect(result).toContain('"count": 42');
    expect(result).toContain("Found 42 items");
  });

  it("should include metadata when provided", () => {
    const result = formatSuccess(
      [1, 2, 3],
      "Found items",
      { totalCount: 100, hasMore: true }
    );

    expect(result).toContain('"totalCount": 100');
    expect(result).toContain('"hasMore": true');
  });
});

describe("formatError", () => {
  it("should format error response", () => {
    const result = formatError("Something went wrong");

    expect(result).toContain("```json");
    expect(result).toContain('"success": false');
    expect(result).toContain('"error": "Something went wrong"');
    expect(result).toContain("Something went wrong");
  });

  it("should include details when provided", () => {
    const result = formatError("Not found", "The book ID does not exist");

    expect(result).toContain("Not found");
    expect(result).toContain("The book ID does not exist");
  });
});

describe("formatBookList", () => {
  const books: BookResult[] = [
    {
      id: 1,
      title: "The Hobbit",
      authors: "J.R.R. Tolkien",
      series: "Middle-earth",
      seriesIndex: 1,
    },
    {
      id: 2,
      title: "Dune",
      authors: "Frank Herbert",
    },
  ];

  it("should format list of books", () => {
    const result = formatBookList(books, "Search Results");

    expect(result).toContain("# Search Results");
    expect(result).toContain("Found 2 books");
    expect(result).toContain("**The Hobbit**");
    expect(result).toContain("by J.R.R. Tolkien");
    expect(result).toContain("(Middle-earth #1)");
    expect(result).toContain("**Dune**");
    expect(result).toContain("by Frank Herbert");
  });

  it("should handle empty list", () => {
    const result = formatBookList([], "Search Results");

    expect(result).toContain('"success": false');
    expect(result).toContain("No books found");
  });

  it("should show singular 'book' for single result", () => {
    const result = formatBookList([books[0]], "Search Results");

    expect(result).toContain("Found 1 book");
    expect(result).not.toContain("Found 1 books");
  });

  it("should indicate more results available", () => {
    const result = formatBookList(books, "Search Results", { hasMore: true });

    expect(result).toContain("(more available)");
  });

  it("should include query in error when no results", () => {
    const result = formatBookList([], "Search Results", { query: "tag:fiction" });

    expect(result).toContain("Query: tag:fiction");
  });
});

describe("formatAuthorList", () => {
  const authors: AuthorResult[] = [
    { id: 1, name: "Brandon Sanderson", bookCount: 25 },
    { id: 2, name: "Robin Hobb", bookCount: 1 },
  ];

  it("should format list of authors", () => {
    const result = formatAuthorList(authors, "Author Search");

    expect(result).toContain("# Author Search");
    expect(result).toContain("Found 2 authors");
    expect(result).toContain("**Brandon Sanderson** (ID: 1): 25 books");
    expect(result).toContain("**Robin Hobb** (ID: 2): 1 book");
  });

  it("should handle empty list", () => {
    const result = formatAuthorList([], "Author Search");

    expect(result).toContain("No authors found");
  });
});

describe("formatTagList", () => {
  const tags: TagResult[] = [
    { name: "fiction", bookCount: 100 },
    { name: "rare-tag", bookCount: 1 },
  ];

  it("should format list of tags", () => {
    const result = formatTagList(tags, "All Tags");

    expect(result).toContain("# All Tags");
    expect(result).toContain("Found 2 tags");
    expect(result).toContain("**fiction**: 100 books");
    expect(result).toContain("**rare-tag**: 1 book");
  });

  it("should handle empty list", () => {
    const result = formatTagList([], "All Tags");

    expect(result).toContain("No tags found");
  });
});

describe("parseCalibreBookList", () => {
  it("should parse valid JSON output", () => {
    const json = JSON.stringify([
      {
        id: 1,
        title: "The Hobbit",
        authors: "J.R.R. Tolkien",
        series: "Middle-earth",
        series_index: 1,
        tags: "fantasy, classic",
        formats: "/path/book.epub, /path/book.pdf",
        pubdate: "1937-09-21",
        rating: 10,
      },
    ]);

    const result = parseCalibreBookList(json);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(result[0].title).toBe("The Hobbit");
    expect(result[0].authors).toBe("J.R.R. Tolkien");
    expect(result[0].series).toBe("Middle-earth");
    expect(result[0].seriesIndex).toBe(1);
    expect(result[0].tags).toEqual(["fantasy", "classic"]);
    expect(result[0].formats).toEqual(["EPUB", "PDF"]);
    expect(result[0].pubdate).toBe("1937-09-21");
    expect(result[0].rating).toBe(10);
  });

  it("should handle missing optional fields", () => {
    const json = JSON.stringify([
      {
        id: 1,
        title: "Simple Book",
        authors: "Author",
      },
    ]);

    const result = parseCalibreBookList(json);

    expect(result[0].series).toBeUndefined();
    expect(result[0].seriesIndex).toBeUndefined();
    expect(result[0].tags).toBeUndefined();
    expect(result[0].formats).toBeUndefined();
  });

  it("should handle missing title and authors", () => {
    const json = JSON.stringify([{ id: 1 }]);

    const result = parseCalibreBookList(json);

    expect(result[0].title).toBe("Unknown");
    expect(result[0].authors).toBe("Unknown");
  });

  it("should return empty array for invalid JSON", () => {
    const result = parseCalibreBookList("not valid json");

    expect(result).toEqual([]);
  });

  it("should return empty array for non-array JSON", () => {
    const result = parseCalibreBookList('{"notAnArray": true}');

    expect(result).toEqual([]);
  });

  it("should handle empty array", () => {
    const result = parseCalibreBookList("[]");

    expect(result).toEqual([]);
  });

  it("should parse multiple books", () => {
    const json = JSON.stringify([
      { id: 1, title: "Book 1", authors: "Author 1" },
      { id: 2, title: "Book 2", authors: "Author 2" },
      { id: 3, title: "Book 3", authors: "Author 3" },
    ]);

    const result = parseCalibreBookList(json);

    expect(result).toHaveLength(3);
    expect(result.map((b) => b.id)).toEqual([1, 2, 3]);
  });
});

describe("formatNoResults", () => {
  it("should format basic no results message", () => {
    const result = formatNoResults({ entityType: "books" });

    expect(result).toBe("No books found in the library.");
  });

  it("should format message with query", () => {
    const result = formatNoResults({ entityType: "books", query: "tolkien" });

    expect(result).toBe('No books found matching: "tolkien"');
  });

  it("should format message with field and query", () => {
    const result = formatNoResults({
      entityType: "books",
      query: "tolkien",
      field: "author",
    });

    expect(result).toBe('No books found matching author: "tolkien"');
  });

  it("should format message with exact match", () => {
    const result = formatNoResults({
      entityType: "books",
      query: "The Hobbit",
      field: "title",
      exact: true,
    });

    expect(result).toBe('No books found with exact title: "The Hobbit"');
  });

  it("should include context when provided", () => {
    const result = formatNoResults({
      entityType: "tags",
      context: "The library may not have any tags defined.",
    });

    expect(result).toContain("No tags found in the library.");
    expect(result).toContain("The library may not have any tags defined.");
  });

  it("should include suggestion when provided", () => {
    const result = formatNoResults({
      entityType: "books",
      query: "asdf",
      field: "title",
      suggestion: "Try a different search term.",
    });

    expect(result).toContain('No books found matching title: "asdf"');
    expect(result).toContain("Try a different search term.");
  });

  it("should work with different entity types", () => {
    expect(formatNoResults({ entityType: "authors" })).toBe(
      "No authors found in the library."
    );
    expect(formatNoResults({ entityType: "tags" })).toBe(
      "No tags found in the library."
    );
    expect(formatNoResults({ entityType: "series" })).toBe(
      "No series found in the library."
    );
    expect(formatNoResults({ entityType: "results" })).toBe(
      "No results found in the library."
    );
    expect(formatNoResults({ entityType: "matches" })).toBe(
      "No matches found in the library."
    );
  });
});

describe("formatNoBooksFound", () => {
  it("should format basic message", () => {
    expect(formatNoBooksFound()).toBe("No books found in the library.");
  });

  it("should format message with query and field", () => {
    expect(formatNoBooksFound("Sanderson", "author")).toBe(
      'No books found matching author: "Sanderson"'
    );
  });

  it("should format exact match message", () => {
    expect(formatNoBooksFound("Dune", "title", true)).toBe(
      'No books found with exact title: "Dune"'
    );
  });
});

describe("formatNoAuthorsFound", () => {
  it("should format basic message", () => {
    expect(formatNoAuthorsFound()).toBe("No authors found in the library.");
  });

  it("should format message with query", () => {
    expect(formatNoAuthorsFound("Smith")).toBe(
      'No authors found matching name: "Smith"'
    );
  });
});

describe("formatNoTagsFound", () => {
  it("should format basic message", () => {
    expect(formatNoTagsFound()).toBe("No tags found in the library.");
  });

  it("should format message with query", () => {
    expect(formatNoTagsFound("fiction")).toBe(
      'No tags found matching pattern: "fiction"'
    );
  });
});
