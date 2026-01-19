import { z } from "zod";
import type { InferSchema } from "xmcp";

import { runCalibredb } from "../utils/calibredb";

export const schema = {
  author: z
    .string()
    .min(1)
    .describe(
      "Author name to search for. Partial matches supported (e.g., 'Tolkien' finds books by 'J.R.R. Tolkien')."
    ),
  exact: z
    .boolean()
    .default(false)
    .describe(
      "If true, match the exact author name. If false (default), perform a partial/contains search."
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .default(50)
    .describe("Maximum number of results to return (default: 50, max: 100)."),
  sortBy: z
    .enum(["title", "pubdate", "timestamp", "series", "rating"])
    .default("title")
    .describe("Field to sort results by (default: title)."),
  ascending: z
    .boolean()
    .default(true)
    .describe("Sort in ascending order (default: true)."),
};

export const metadata = {
  name: "get_books_by_author",
  description:
    "Get all books by a specific author. Returns book details including title, series, tags, and formats. Use search_authors_by_name first if you need to find the exact author name.",
  annotations: {
    title: "Get books by author",
    idempotentHint: true,
    readOnlyHint: true,
    destructiveHint: false,
  },
};

export default async function getBooksByAuthor({
  author,
  exact,
  limit,
  sortBy,
  ascending,
}: InferSchema<typeof schema>): Promise<string> {
  // Build the Calibre query
  // ~pattern means "contains" in Calibre search
  // =pattern means "equals" (exact match)
  const query = exact ? `author:"=${author}"` : `author:"~${author}"`;

  const args = [
    "list",
    "--fields",
    "id,title,authors,series,series_index,tags,pubdate,formats",
    "--search",
    query,
    "--sort-by",
    sortBy === "series" ? "series" : sortBy,
    "--limit",
    String(limit),
  ];

  if (ascending) {
    args.push("--ascending");
  }

  const output = await runCalibredb(args);

  if (!output) {
    return exact
      ? `No books found by author: "${author}"`
      : `No books found matching author: "${author}"`;
  }

  // Add a header to the output
  const header = exact
    ? `# Books by "${author}"`
    : `# Books matching author "${author}"`;

  return `${header}\n\n${output}`;
}
