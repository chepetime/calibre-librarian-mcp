/**
 * Ebook conversion utilities using Calibre's ebook-convert tool.
 *
 * Provides helpers for converting ebook files to plain text,
 * useful for content extraction and text search operations.
 */

import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";

/**
 * Default format preference order for text extraction.
 * Ordered by text extraction quality (EPUB generally provides best results).
 */
export const TEXT_FRIENDLY_FORMATS = ["epub", "txt", "mobi", "azw3", "pdf"] as const;

/**
 * Extract the file extension from a path.
 *
 * @param filePath - Path to the file
 * @returns Lowercase file extension without the dot, or empty string if none
 *
 * @example
 * getFormatExtension("/path/to/book.epub")
 * // Returns: "epub"
 */
export function getFormatExtension(filePath: string): string {
  return filePath.split(".").pop()?.toLowerCase() || "";
}

/**
 * Select the best format path for text extraction from a list of available formats.
 *
 * @param formatPaths - Array of file paths to available formats
 * @param preferredFormat - Optional specific format to prefer
 * @returns The selected format path, or null if no suitable format found
 *
 * @example
 * const formats = ["/path/book.pdf", "/path/book.epub", "/path/book.mobi"];
 * selectBestFormat(formats)
 * // Returns: "/path/book.epub" (epub is preferred)
 *
 * selectBestFormat(formats, "pdf")
 * // Returns: "/path/book.pdf" (explicit preference)
 */
export function selectBestFormat(
  formatPaths: string[],
  preferredFormat?: string
): string | null {
  if (formatPaths.length === 0) return null;

  // If a specific format is requested, try to find it
  if (preferredFormat) {
    const match = formatPaths.find(
      (p) => getFormatExtension(p) === preferredFormat.toLowerCase()
    );
    return match || null;
  }

  // Otherwise, use preference order
  for (const fmt of TEXT_FRIENDLY_FORMATS) {
    const match = formatPaths.find((p) => getFormatExtension(p) === fmt);
    if (match) return match;
  }

  // Fall back to first available
  return formatPaths[0];
}

/**
 * Get a list of available format extensions from format paths.
 *
 * @param formatPaths - Array of file paths
 * @returns Array of uppercase format extensions
 *
 * @example
 * getAvailableFormats(["/path/book.epub", "/path/book.pdf"])
 * // Returns: ["EPUB", "PDF"]
 */
export function getAvailableFormats(formatPaths: string[]): string[] {
  return formatPaths.map((p) => getFormatExtension(p).toUpperCase());
}

/**
 * Options for the convertToText function.
 */
export interface ConvertToTextOptions {
  /**
   * Timeout in milliseconds (default: 60000ms / 1 minute).
   */
  timeoutMs?: number;
}

/**
 * Convert an ebook file to plain text using Calibre's ebook-convert tool.
 *
 * @param inputPath - Path to the ebook file
 * @param options - Conversion options
 * @returns The extracted text content
 * @throws Error if conversion fails or times out
 *
 * @example
 * const text = await convertToText("/path/to/book.epub");
 *
 * @example
 * const text = await convertToText("/path/to/book.pdf", { timeoutMs: 120000 });
 */
export async function convertToText(
  inputPath: string,
  options: ConvertToTextOptions = {}
): Promise<string> {
  const { timeoutMs = 60000 } = options;
  const outputPath = join(tmpdir(), `calibre-convert-${randomUUID()}.txt`);

  return new Promise((resolve, reject) => {
    const child = spawn("ebook-convert", [inputPath, outputPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`ebook-convert timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", async (code) => {
      clearTimeout(timer);
      if (code === 0) {
        try {
          const text = await readFile(outputPath, "utf8");
          // Clean up temp file
          await unlink(outputPath).catch(() => {});
          resolve(text);
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error(`ebook-convert exited with code ${code}`));
      }
    });
  });
}
