import { describe, it, expect } from "vitest";
import {
  getFormatExtension,
  selectBestFormat,
  getAvailableFormats,
  TEXT_FRIENDLY_FORMATS,
} from "./ebook-convert";

describe("getFormatExtension", () => {
  it("extracts lowercase extension from path", () => {
    expect(getFormatExtension("/path/to/book.epub")).toBe("epub");
  });

  it("handles uppercase extensions", () => {
    expect(getFormatExtension("/path/to/book.EPUB")).toBe("epub");
  });

  it("handles mixed case extensions", () => {
    expect(getFormatExtension("/path/to/book.EpUb")).toBe("epub");
  });

  it("extracts last extension from multiple dots", () => {
    expect(getFormatExtension("/path/to/book.backup.pdf")).toBe("pdf");
  });

  it("returns full path for no extension (edge case)", () => {
    // Note: paths without dots are rare for ebook files; returns full lowercased path
    expect(getFormatExtension("/path/to/book")).toBe("/path/to/book");
  });

  it("returns empty string for path ending with dot", () => {
    expect(getFormatExtension("/path/to/book.")).toBe("");
  });

  it("handles various ebook formats", () => {
    expect(getFormatExtension("/path/book.mobi")).toBe("mobi");
    expect(getFormatExtension("/path/book.azw3")).toBe("azw3");
    expect(getFormatExtension("/path/book.pdf")).toBe("pdf");
    expect(getFormatExtension("/path/book.txt")).toBe("txt");
  });
});

describe("selectBestFormat", () => {
  const formats = [
    "/books/test.pdf",
    "/books/test.epub",
    "/books/test.mobi",
  ];

  it("selects epub by default (highest priority)", () => {
    expect(selectBestFormat(formats)).toBe("/books/test.epub");
  });

  it("selects txt if available and no epub", () => {
    const txtFormats = ["/books/test.pdf", "/books/test.txt"];
    expect(selectBestFormat(txtFormats)).toBe("/books/test.txt");
  });

  it("selects preferred format when specified", () => {
    expect(selectBestFormat(formats, "pdf")).toBe("/books/test.pdf");
  });

  it("returns null for empty array", () => {
    expect(selectBestFormat([])).toBeNull();
  });

  it("returns null if preferred format not available", () => {
    expect(selectBestFormat(formats, "azw3")).toBeNull();
  });

  it("falls back to first format if no preferred formats available", () => {
    const unknownFormats = ["/books/test.cbz", "/books/test.cbr"];
    expect(selectBestFormat(unknownFormats)).toBe("/books/test.cbz");
  });

  it("handles case-insensitive preferred format", () => {
    expect(selectBestFormat(formats, "PDF")).toBe("/books/test.pdf");
    expect(selectBestFormat(formats, "EPUB")).toBe("/books/test.epub");
  });

  it("follows TEXT_FRIENDLY_FORMATS order", () => {
    // epub > txt > mobi > azw3 > pdf
    const mobiPdf = ["/test.pdf", "/test.mobi"];
    expect(selectBestFormat(mobiPdf)).toBe("/test.mobi");

    const azw3Pdf = ["/test.pdf", "/test.azw3"];
    expect(selectBestFormat(azw3Pdf)).toBe("/test.azw3");
  });
});

describe("getAvailableFormats", () => {
  it("returns uppercase format extensions", () => {
    const formats = ["/path/book.epub", "/path/book.pdf"];
    expect(getAvailableFormats(formats)).toEqual(["EPUB", "PDF"]);
  });

  it("returns empty array for empty input", () => {
    expect(getAvailableFormats([])).toEqual([]);
  });

  it("handles mixed case extensions", () => {
    const formats = ["/path/book.EPUB", "/path/book.Pdf"];
    expect(getAvailableFormats(formats)).toEqual(["EPUB", "PDF"]);
  });

  it("preserves order of input", () => {
    const formats = ["/path/book.mobi", "/path/book.epub", "/path/book.pdf"];
    expect(getAvailableFormats(formats)).toEqual(["MOBI", "EPUB", "PDF"]);
  });
});

describe("TEXT_FRIENDLY_FORMATS", () => {
  it("has epub as highest priority", () => {
    expect(TEXT_FRIENDLY_FORMATS[0]).toBe("epub");
  });

  it("has txt as second priority", () => {
    expect(TEXT_FRIENDLY_FORMATS[1]).toBe("txt");
  });

  it("includes common ebook formats", () => {
    expect(TEXT_FRIENDLY_FORMATS).toContain("epub");
    expect(TEXT_FRIENDLY_FORMATS).toContain("mobi");
    expect(TEXT_FRIENDLY_FORMATS).toContain("azw3");
    expect(TEXT_FRIENDLY_FORMATS).toContain("pdf");
    expect(TEXT_FRIENDLY_FORMATS).toContain("txt");
  });
});

// Note: convertToText is not unit tested here because it spawns external processes.
// It would need integration tests with actual ebook files and ebook-convert installed.
