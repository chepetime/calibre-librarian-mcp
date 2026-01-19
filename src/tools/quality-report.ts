import { z } from "zod";
import type { InferSchema } from "xmcp";

import { runCalibredb } from "../utils/calibredb";

export const schema = {
  checks: z
    .array(
      z.enum([
        "missing_cover",
        "missing_tags",
        "missing_description",
        "missing_series",
        "single_format",
        "missing_identifiers",
        "missing_publisher",
        "no_rating",
      ])
    )
    .optional()
    .describe(
      "Specific quality checks to run. If not provided, runs all checks."
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .default(25)
    .describe("Maximum books to show per category (default: 25)."),
};

export const metadata = {
  name: "quality_report",
  description:
    "Generate a quality report for the library, identifying books with missing metadata, covers, or other issues. Helps prioritize cleanup tasks.",
  annotations: {
    title: "Quality report",
    idempotentHint: true,
    readOnlyHint: true,
    destructiveHint: false,
  },
};

interface Book {
  id: number;
  title: string;
  authors: string;
  tags?: string;
  comments?: string;
  series?: string;
  formats?: string;
  identifiers?: string;
  publisher?: string;
  rating?: number;
  cover?: string;
}

interface QualityIssue {
  check: string;
  description: string;
  books: Book[];
  total: number;
}

const ALL_CHECKS = [
  "missing_cover",
  "missing_tags",
  "missing_description",
  "missing_series",
  "single_format",
  "missing_identifiers",
  "missing_publisher",
  "no_rating",
] as const;

const CHECK_DESCRIPTIONS: Record<string, string> = {
  missing_cover: "Books without cover images",
  missing_tags: "Books with no tags assigned",
  missing_description: "Books without descriptions/comments",
  missing_series: "Books not assigned to any series",
  single_format: "Books with only one format",
  missing_identifiers: "Books without ISBN or other identifiers",
  missing_publisher: "Books with no publisher information",
  no_rating: "Books that haven't been rated",
};

async function getAllBooks(): Promise<Book[]> {
  const output = await runCalibredb([
    "list",
    "--fields",
    "id,title,authors,tags,comments,series,formats,identifiers,publisher,rating,cover",
    "--for-machine",
  ]);

  if (!output) return [];

  const books = JSON.parse(output);
  return books.map((b: Record<string, unknown>) => ({
    id: b.id as number,
    title: b.title as string,
    authors: b.authors as string,
    tags: b.tags as string | undefined,
    comments: b.comments as string | undefined,
    series: b.series as string | undefined,
    formats: b.formats as string | undefined,
    identifiers: b.identifiers as string | undefined,
    publisher: b.publisher as string | undefined,
    rating: b.rating as number | undefined,
    cover: b.cover as string | undefined,
  }));
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "number") return false;
  return false;
}

function checkBooks(
  books: Book[],
  check: string,
  limit: number
): QualityIssue | null {
  let filtered: Book[];

  switch (check) {
    case "missing_cover":
      filtered = books.filter((b) => isEmpty(b.cover));
      break;
    case "missing_tags":
      filtered = books.filter((b) => isEmpty(b.tags));
      break;
    case "missing_description":
      filtered = books.filter((b) => isEmpty(b.comments));
      break;
    case "missing_series":
      filtered = books.filter((b) => isEmpty(b.series));
      break;
    case "single_format":
      filtered = books.filter((b) => {
        if (isEmpty(b.formats)) return false;
        const formats = b.formats!.split(",").map((f) => f.trim());
        return formats.length === 1;
      });
      break;
    case "missing_identifiers":
      filtered = books.filter((b) => isEmpty(b.identifiers));
      break;
    case "missing_publisher":
      filtered = books.filter((b) => isEmpty(b.publisher));
      break;
    case "no_rating":
      filtered = books.filter((b) => isEmpty(b.rating) || b.rating === 0);
      break;
    default:
      return null;
  }

  if (filtered.length === 0) return null;

  return {
    check,
    description: CHECK_DESCRIPTIONS[check] || check,
    books: filtered.slice(0, limit),
    total: filtered.length,
  };
}

export default async function qualityReport({
  checks,
  limit,
}: InferSchema<typeof schema>): Promise<string> {
  const books = await getAllBooks();

  if (books.length === 0) {
    return "No books found in the library.";
  }

  const checksToRun = checks || ALL_CHECKS;
  const issues: QualityIssue[] = [];

  for (const check of checksToRun) {
    const issue = checkBooks(books, check, limit);
    if (issue) {
      issues.push(issue);
    }
  }

  if (issues.length === 0) {
    return `# Library Quality Report\n\n✓ No issues found! All ${books.length} books pass the selected quality checks.`;
  }

  const lines = [
    "# Library Quality Report",
    "",
    `**Total books scanned:** ${books.length}`,
    `**Checks performed:** ${checksToRun.length}`,
    `**Issues found:** ${issues.length} categories`,
    "",
  ];

  // Summary table
  lines.push("## Summary");
  lines.push("");
  lines.push("| Issue | Count | % of Library |");
  lines.push("|-------|-------|--------------|");

  for (const issue of issues) {
    const percentage = ((issue.total / books.length) * 100).toFixed(1);
    lines.push(`| ${issue.description} | ${issue.total} | ${percentage}% |`);
  }

  lines.push("");

  // Detailed sections
  for (const issue of issues) {
    lines.push(`## ${issue.description}`);
    lines.push("");
    lines.push(
      `Found ${issue.total} book${issue.total === 1 ? "" : "s"}${issue.total > limit ? ` (showing first ${limit})` : ""}`
    );
    lines.push("");

    for (const book of issue.books) {
      let details = `- **ID ${book.id}:** ${book.title} by ${book.authors}`;

      // Add relevant context based on the check
      if (issue.check === "single_format" && book.formats) {
        details += ` (Format: ${book.formats.split(",")[0].trim().split("/").pop()})`;
      }

      lines.push(details);
    }

    lines.push("");
  }

  // Recommendations
  lines.push("---");
  lines.push("");
  lines.push("## Recommendations");
  lines.push("");

  if (issues.some((i) => i.check === "missing_cover")) {
    lines.push(
      "- **Missing covers:** Use Calibre's \"Download metadata\" feature to fetch covers"
    );
  }
  if (issues.some((i) => i.check === "missing_tags")) {
    lines.push(
      "- **Missing tags:** Use `set_metadata` to add tags, or bulk-edit in Calibre"
    );
  }
  if (issues.some((i) => i.check === "missing_identifiers")) {
    lines.push(
      "- **Missing identifiers:** Download metadata in Calibre to fetch ISBNs"
    );
  }
  if (issues.some((i) => i.check === "single_format")) {
    lines.push(
      "- **Single format:** Consider converting to additional formats for flexibility"
    );
  }

  lines.push("");
  lines.push(
    "Use `get_book_details <id>` to inspect specific books, or `set_metadata` to fix issues."
  );

  return lines.join("\n");
}
