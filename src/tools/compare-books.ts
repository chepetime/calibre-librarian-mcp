import { z } from "zod";
import type { InferSchema } from "xmcp";

import { runCalibredb } from "../utils/calibredb";

export const schema = {
  bookIds: z
    .array(z.number().int().positive())
    .min(2)
    .max(5)
    .describe("List of 2-5 book IDs to compare."),
  fields: z
    .array(
      z.enum([
        "title",
        "authors",
        "series",
        "tags",
        "publisher",
        "pubdate",
        "rating",
        "formats",
        "identifiers",
        "languages",
        "comments",
      ])
    )
    .optional()
    .describe(
      "Specific fields to compare. If not provided, compares all common fields."
    ),
};

export const metadata = {
  name: "compare_books",
  description:
    "Compare metadata between multiple books side-by-side. Useful for deciding which duplicate to keep, verifying metadata consistency, or identifying differences between editions. Highlights differences between books.",
  annotations: {
    title: "Compare books",
    idempotentHint: true,
    readOnlyHint: true,
    destructiveHint: false,
  },
};

interface BookMetadata {
  id: number;
  title: string;
  authors: string;
  series?: string;
  series_index?: number;
  tags?: string;
  publisher?: string;
  pubdate?: string;
  rating?: number;
  formats?: string;
  identifiers?: string;
  languages?: string;
  comments?: string;
}

const ALL_FIELDS = [
  "title",
  "authors",
  "series",
  "tags",
  "publisher",
  "pubdate",
  "rating",
  "formats",
  "identifiers",
  "languages",
  "comments",
] as const;

async function getBookMetadata(bookId: number): Promise<BookMetadata | null> {
  try {
    const output = await runCalibredb([
      "list",
      "--fields",
      "id,title,authors,series,series_index,tags,publisher,pubdate,rating,formats,identifiers,languages,comments",
      "--search",
      `id:${bookId}`,
      "--for-machine",
    ]);

    if (!output) return null;

    const books = JSON.parse(output);
    if (!Array.isArray(books) || books.length === 0) return null;

    return books[0] as BookMetadata;
  } catch {
    return null;
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "(empty)";
  }
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    // Truncate long values
    if (value.length > 100) {
      return value.slice(0, 100) + "...";
    }
    return value;
  }
  return String(value);
}

function valuesMatch(values: unknown[]): boolean {
  const normalized = values.map((v) =>
    v === null || v === undefined || v === "" ? null : String(v).toLowerCase().trim()
  );
  const first = normalized[0];
  return normalized.every((v) => v === first);
}

export default async function compareBooks({
  bookIds,
  fields,
}: InferSchema<typeof schema>): Promise<string> {
  // Fetch metadata for all books
  const books: BookMetadata[] = [];
  const notFound: number[] = [];

  for (const id of bookIds) {
    const metadata = await getBookMetadata(id);
    if (metadata) {
      books.push(metadata);
    } else {
      notFound.push(id);
    }
  }

  if (notFound.length > 0) {
    return `Book(s) not found: ${notFound.join(", ")}`;
  }

  if (books.length < 2) {
    return "Need at least 2 books to compare.";
  }

  const fieldsToCompare = fields || ALL_FIELDS;

  const lines = [
    "# Book Comparison",
    "",
    `Comparing ${books.length} books: ${bookIds.join(", ")}`,
    "",
  ];

  // Create comparison table header
  lines.push("| Field | " + books.map((b) => `ID ${b.id}`).join(" | ") + " | Match |");
  lines.push("|-------|" + books.map(() => "------").join("|") + "|-------|");

  // Compare each field
  const differences: string[] = [];

  for (const field of fieldsToCompare) {
    const values = books.map((b) => {
      if (field === "series" && b.series) {
        return b.series_index ? `${b.series} #${b.series_index}` : b.series;
      }
      return (b as unknown as Record<string, unknown>)[field];
    });

    const match = valuesMatch(values);
    const matchIcon = match ? "✓" : "✗";

    if (!match) {
      differences.push(field);
    }

    const formattedValues = values.map((v) => formatValue(v));
    lines.push(`| **${field}** | ${formattedValues.join(" | ")} | ${matchIcon} |`);
  }

  lines.push("");

  // Summary
  if (differences.length === 0) {
    lines.push("## Summary");
    lines.push("");
    lines.push("All compared fields match between these books.");
  } else {
    lines.push("## Differences Found");
    lines.push("");
    lines.push(`The following fields differ: **${differences.join(", ")}**`);
    lines.push("");

    // Provide recommendations
    lines.push("## Recommendations");
    lines.push("");

    if (differences.includes("formats")) {
      lines.push(
        "- **Formats differ:** Consider keeping the book with more/better formats, or merge formats if possible."
      );
    }

    if (differences.includes("tags")) {
      lines.push(
        "- **Tags differ:** You may want to combine tags from both books before removing a duplicate."
      );
    }

    if (differences.includes("rating")) {
      lines.push("- **Ratings differ:** Keep the one with your preferred rating.");
    }

    if (differences.includes("comments")) {
      lines.push(
        "- **Comments differ:** Check which has a better description before deciding."
      );
    }

    if (differences.includes("identifiers")) {
      lines.push(
        "- **Identifiers differ:** The book with more identifiers (ISBN, etc.) may have better metadata linking."
      );
    }
  }

  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    "Use `set_metadata` to update fields before removing duplicates, or `get_book_details` for full metadata."
  );

  return lines.join("\n");
}
