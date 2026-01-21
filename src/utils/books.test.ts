import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getBookById,
  getBooksByIds,
  bookExists,
  getBookWithFormats,
  getBookTitle,
} from "./books";
import * as calibredb from "./calibredb";

// Mock the calibredb module
vi.mock("./calibredb", () => ({
  runCalibredb: vi.fn(),
}));

describe("getBookById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns book when found", async () => {
    vi.mocked(calibredb.runCalibredb).mockResolvedValue(
      JSON.stringify([{ id: 123, title: "The Hobbit", authors: "J.R.R. Tolkien" }])
    );

    const book = await getBookById(123);

    expect(book).toEqual({
      id: 123,
      title: "The Hobbit",
      authors: "J.R.R. Tolkien",
    });
  });

  it("returns null when book not found", async () => {
    vi.mocked(calibredb.runCalibredb).mockResolvedValue(JSON.stringify([]));

    const book = await getBookById(999);

    expect(book).toBeNull();
  });

  it("returns null on empty output", async () => {
    vi.mocked(calibredb.runCalibredb).mockResolvedValue("");

    const book = await getBookById(123);

    expect(book).toBeNull();
  });

  it("returns null on invalid JSON", async () => {
    vi.mocked(calibredb.runCalibredb).mockResolvedValue("not json");

    const book = await getBookById(123);

    expect(book).toBeNull();
  });

  it("returns null on error", async () => {
    vi.mocked(calibredb.runCalibredb).mockRejectedValue(new Error("Failed"));

    const book = await getBookById(123);

    expect(book).toBeNull();
  });

  it("uses custom fields when provided", async () => {
    vi.mocked(calibredb.runCalibredb).mockResolvedValue(
      JSON.stringify([{ id: 1, title: "Test", tags: "fiction" }])
    );

    await getBookById(1, { fields: "id,title,tags" });

    expect(calibredb.runCalibredb).toHaveBeenCalledWith(
      expect.arrayContaining(["--fields", "id,title,tags"])
    );
  });

  it("uses field preset when provided", async () => {
    vi.mocked(calibredb.runCalibredb).mockResolvedValue(
      JSON.stringify([{ id: 1, title: "Test" }])
    );

    await getBookById(1, { fields: "BASIC" });

    expect(calibredb.runCalibredb).toHaveBeenCalledWith(
      expect.arrayContaining(["--fields", "id,title,authors,tags,series,formats"])
    );
  });

  it("builds correct search query for book ID", async () => {
    vi.mocked(calibredb.runCalibredb).mockResolvedValue(JSON.stringify([]));

    await getBookById(42);

    expect(calibredb.runCalibredb).toHaveBeenCalledWith(
      expect.arrayContaining(["--search", "id:42"])
    );
  });

  it("includes --for-machine flag", async () => {
    vi.mocked(calibredb.runCalibredb).mockResolvedValue(JSON.stringify([]));

    await getBookById(1);

    expect(calibredb.runCalibredb).toHaveBeenCalledWith(
      expect.arrayContaining(["--for-machine"])
    );
  });
});

describe("getBooksByIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all books when all found", async () => {
    vi.mocked(calibredb.runCalibredb)
      .mockResolvedValueOnce(JSON.stringify([{ id: 1, title: "Book 1", authors: "Author 1" }]))
      .mockResolvedValueOnce(JSON.stringify([{ id: 2, title: "Book 2", authors: "Author 2" }]));

    const result = await getBooksByIds([1, 2]);

    expect(result.books).toHaveLength(2);
    expect(result.notFound).toHaveLength(0);
  });

  it("tracks not-found books", async () => {
    vi.mocked(calibredb.runCalibredb)
      .mockResolvedValueOnce(JSON.stringify([{ id: 1, title: "Book 1", authors: "Author 1" }]))
      .mockResolvedValueOnce(JSON.stringify([])); // Book 2 not found

    const result = await getBooksByIds([1, 2]);

    expect(result.books).toHaveLength(1);
    expect(result.notFound).toEqual([2]);
  });

  it("returns empty books with all IDs in notFound when none found", async () => {
    vi.mocked(calibredb.runCalibredb).mockResolvedValue(JSON.stringify([]));

    const result = await getBooksByIds([1, 2, 3]);

    expect(result.books).toHaveLength(0);
    expect(result.notFound).toEqual([1, 2, 3]);
  });

  it("handles empty ID array", async () => {
    const result = await getBooksByIds([]);

    expect(result.books).toHaveLength(0);
    expect(result.notFound).toHaveLength(0);
  });

  it("uses custom fields for all books", async () => {
    vi.mocked(calibredb.runCalibredb).mockResolvedValue(
      JSON.stringify([{ id: 1, title: "Test", tags: "fiction" }])
    );

    await getBooksByIds([1, 2], { fields: "id,title,tags" });

    // Should be called twice with the same fields
    expect(calibredb.runCalibredb).toHaveBeenCalledTimes(2);
    expect(calibredb.runCalibredb).toHaveBeenNthCalledWith(
      1,
      expect.arrayContaining(["--fields", "id,title,tags"])
    );
    expect(calibredb.runCalibredb).toHaveBeenNthCalledWith(
      2,
      expect.arrayContaining(["--fields", "id,title,tags"])
    );
  });
});

describe("bookExists", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns book info when exists", async () => {
    vi.mocked(calibredb.runCalibredb).mockResolvedValue(
      JSON.stringify([{ id: 1, title: "Test Book", authors: "Test Author" }])
    );

    const result = await bookExists(1);

    expect(result).toEqual({
      id: 1,
      title: "Test Book",
      authors: "Test Author",
    });
  });

  it("returns null when book does not exist", async () => {
    vi.mocked(calibredb.runCalibredb).mockResolvedValue(JSON.stringify([]));

    const result = await bookExists(999);

    expect(result).toBeNull();
  });

  it("uses basic fields", async () => {
    vi.mocked(calibredb.runCalibredb).mockResolvedValue(JSON.stringify([]));

    await bookExists(1);

    expect(calibredb.runCalibredb).toHaveBeenCalledWith(
      expect.arrayContaining(["--fields", "id,title,authors"])
    );
  });
});

describe("getBookWithFormats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns book with parsed format paths", async () => {
    vi.mocked(calibredb.runCalibredb).mockResolvedValue(
      JSON.stringify([
        {
          id: 1,
          title: "Test Book",
          authors: "Test Author",
          formats: "/path/to/book.epub, /path/to/book.pdf",
        },
      ])
    );

    const result = await getBookWithFormats(1);

    expect(result).toEqual({
      id: 1,
      title: "Test Book",
      authors: "Test Author",
      formats: ["/path/to/book.epub", "/path/to/book.pdf"],
    });
  });

  it("returns empty formats array when no formats", async () => {
    vi.mocked(calibredb.runCalibredb).mockResolvedValue(
      JSON.stringify([
        {
          id: 1,
          title: "Test Book",
          authors: "Test Author",
          formats: "",
        },
      ])
    );

    const result = await getBookWithFormats(1);

    expect(result?.formats).toEqual([]);
  });

  it("handles undefined formats field", async () => {
    vi.mocked(calibredb.runCalibredb).mockResolvedValue(
      JSON.stringify([
        {
          id: 1,
          title: "Test Book",
          authors: "Test Author",
        },
      ])
    );

    const result = await getBookWithFormats(1);

    expect(result?.formats).toEqual([]);
  });

  it("returns null when book not found", async () => {
    vi.mocked(calibredb.runCalibredb).mockResolvedValue(JSON.stringify([]));

    const result = await getBookWithFormats(999);

    expect(result).toBeNull();
  });
});

describe("getBookTitle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns book title when found", async () => {
    vi.mocked(calibredb.runCalibredb).mockResolvedValue(
      JSON.stringify([{ id: 1, title: "The Hobbit" }])
    );

    const title = await getBookTitle(1);

    expect(title).toBe("The Hobbit");
  });

  it("returns default fallback when not found", async () => {
    vi.mocked(calibredb.runCalibredb).mockResolvedValue(JSON.stringify([]));

    const title = await getBookTitle(123);

    expect(title).toBe("Book ID 123");
  });

  it("returns custom fallback when provided", async () => {
    vi.mocked(calibredb.runCalibredb).mockResolvedValue(JSON.stringify([]));

    const title = await getBookTitle(123, "Unknown Book");

    expect(title).toBe("Unknown Book");
  });

  it("uses id,title fields only", async () => {
    vi.mocked(calibredb.runCalibredb).mockResolvedValue(JSON.stringify([]));

    await getBookTitle(1);

    expect(calibredb.runCalibredb).toHaveBeenCalledWith(
      expect.arrayContaining(["--fields", "id,title"])
    );
  });
});
