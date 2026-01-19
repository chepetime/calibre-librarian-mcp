import { z } from "zod";
import type { InferSchema } from "xmcp";

import { runCalibredb } from "../utils/calibredb";

export const schema = {};

export const metadata = {
  name: "get_library_stats",
  description:
    "Get library statistics including total book count, format breakdown, tag counts, author counts, and series counts. Useful for understanding the composition of your Calibre library.",
  annotations: {
    title: "Get library statistics",
    idempotentHint: true,
    readOnlyHint: true,
    destructiveHint: false,
  },
};

interface LibraryStats {
  totalBooks: number;
  totalAuthors: number;
  totalTags: number;
  totalSeries: number;
  totalPublishers: number;
  formats: Record<string, number>;
  topTags: Array<{ name: string; count: number }>;
  topAuthors: Array<{ name: string; count: number }>;
}

async function getTotalBooks(): Promise<number> {
  try {
    // Get list of all book IDs
    const output = await runCalibredb(["list", "--fields", "id", "--for-machine"]);
    if (!output) return 0;
    const books = JSON.parse(output);
    return Array.isArray(books) ? books.length : 0;
  } catch {
    return 0;
  }
}

async function getFormatCounts(): Promise<Record<string, number>> {
  try {
    const output = await runCalibredb(["list", "--fields", "formats", "--for-machine"]);
    if (!output) return {};

    const books = JSON.parse(output);
    const formatCounts: Record<string, number> = {};

    for (const book of books) {
      const formats = book.formats;
      if (formats && typeof formats === "string") {
        // formats is comma-separated like "EPUB, PDF"
        const formatList = formats.split(",").map((f: string) => f.trim().toUpperCase());
        for (const format of formatList) {
          if (format) {
            formatCounts[format] = (formatCounts[format] || 0) + 1;
          }
        }
      }
    }

    return formatCounts;
  } catch {
    return {};
  }
}

async function getCategoryCounts(
  category: string
): Promise<{ total: number; top: Array<{ name: string; count: number }> }> {
  try {
    // list_categories returns category items with counts
    const output = await runCalibredb(["list_categories", "--for-machine"]);
    if (!output) return { total: 0, top: [] };

    const categories = JSON.parse(output);
    const categoryData = categories[category];

    if (!categoryData || !Array.isArray(categoryData)) {
      return { total: 0, top: [] };
    }

    const items = categoryData
      .filter((item: { name?: string; count?: number }) => item.name && item.count)
      .map((item: { name: string; count: number }) => ({
        name: item.name,
        count: item.count,
      }))
      .sort((a: { count: number }, b: { count: number }) => b.count - a.count);

    return {
      total: items.length,
      top: items.slice(0, 10),
    };
  } catch {
    return { total: 0, top: [] };
  }
}

export default async function getLibraryStats(
  _params: InferSchema<typeof schema>
): Promise<string> {
  // Gather all stats in parallel
  const [totalBooks, formats, authors, tags, series, publishers] = await Promise.all([
    getTotalBooks(),
    getFormatCounts(),
    getCategoryCounts("authors"),
    getCategoryCounts("tags"),
    getCategoryCounts("series"),
    getCategoryCounts("publisher"),
  ]);

  const stats: LibraryStats = {
    totalBooks,
    totalAuthors: authors.total,
    totalTags: tags.total,
    totalSeries: series.total,
    totalPublishers: publishers.total,
    formats,
    topTags: tags.top,
    topAuthors: authors.top,
  };

  // Format as readable summary
  const lines = [
    "# Library Statistics",
    "",
    `**Total Books:** ${stats.totalBooks.toLocaleString()}`,
    `**Total Authors:** ${stats.totalAuthors.toLocaleString()}`,
    `**Total Tags:** ${stats.totalTags.toLocaleString()}`,
    `**Total Series:** ${stats.totalSeries.toLocaleString()}`,
    `**Total Publishers:** ${stats.totalPublishers.toLocaleString()}`,
    "",
    "## Formats",
  ];

  const sortedFormats = Object.entries(stats.formats).sort(([, a], [, b]) => b - a);
  for (const [format, count] of sortedFormats) {
    lines.push(`- ${format}: ${count.toLocaleString()}`);
  }

  if (stats.topAuthors.length > 0) {
    lines.push("", "## Top Authors");
    for (const author of stats.topAuthors) {
      lines.push(`- ${author.name}: ${author.count} books`);
    }
  }

  if (stats.topTags.length > 0) {
    lines.push("", "## Top Tags");
    for (const tag of stats.topTags) {
      lines.push(`- ${tag.name}: ${tag.count} books`);
    }
  }

  return lines.join("\n");
}
