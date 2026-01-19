import { z } from "zod";
import type { InferSchema } from "xmcp";

import { runCalibredb } from "../utils/calibredb";

export const schema = {
  authorId: z
    .number()
    .int()
    .positive()
    .describe(
      "Calibre author ID. Use search_authors_by_name to find author IDs."
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
  name: "get_books_by_author_id",
  description:
    "Get all books by a specific Calibre author ID. More precise than searching by name when dealing with authors who have similar names. Use search_authors_by_name to find author IDs first.",
  annotations: {
    title: "Get books by author ID",
    idempotentHint: true,
    readOnlyHint: true,
    destructiveHint: false,
  },
};

async function getAuthorNameById(authorId: number): Promise<string | null> {
  const output = await runCalibredb(["list_categories", "--for-machine"]);

  if (!output) {
    return null;
  }

  const categories = JSON.parse(output);
  const authorsData = categories.authors;

  if (!authorsData || !Array.isArray(authorsData)) {
    return null;
  }

  const author = authorsData.find(
    (a: { id?: number; name?: string }) => a.id === authorId
  );

  return author?.name ?? null;
}

export default async function getBooksByAuthorId({
  authorId,
  limit,
  sortBy,
  ascending,
}: InferSchema<typeof schema>): Promise<string> {
  // First, look up the author name from the ID
  const authorName = await getAuthorNameById(authorId);

  if (!authorName) {
    return `No author found with ID: ${authorId}. Use search_authors_by_name to find valid author IDs.`;
  }

  // Search for books by the exact author name
  const query = `author:"=${authorName}"`;

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
    return `No books found for author "${authorName}" (ID: ${authorId}).`;
  }

  // Add a header to the output
  const header = `# Books by ${authorName} (ID: ${authorId})`;

  return `${header}\n\n${output}`;
}
