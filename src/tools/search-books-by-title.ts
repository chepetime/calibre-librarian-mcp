import { z } from "zod";
import type { InferSchema } from "xmcp";

import { runCalibredb } from "../utils/calibredb";
import { buildFieldQuery, buildListArgs } from "../utils/query";
import { formatNoBooksFound } from "../utils/response";

export const schema = {
  title: z
    .string()
    .min(1)
    .describe(
      "Title search pattern. Supports partial matches by default (e.g., 'lord' finds 'The Lord of the Rings')."
    ),
  exact: z
    .boolean()
    .default(false)
    .describe(
      "If true, match the exact title. If false (default), perform a wildcard/contains search."
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .default(25)
    .describe("Maximum number of results to return (default: 25, max: 100)."),
  sortBy: z
    .enum(["title", "authors", "rating", "timestamp", "pubdate", "size", "id"])
    .default("title")
    .describe("Field to sort results by (default: title)."),
  ascending: z
    .boolean()
    .default(true)
    .describe("Sort in ascending order (default: true)."),
};

export const metadata = {
  name: "search_books_by_title",
  description:
    "Search books by title with wildcard support. Simpler interface than search_books for quick title lookups. By default performs partial/contains matching (e.g., 'ring' finds 'The Lord of the Rings').",
  annotations: {
    title: "Search books by title",
    idempotentHint: true,
    readOnlyHint: true,
    destructiveHint: false,
  },
};

export default async function searchBooksByTitle({
  title,
  exact,
  limit,
  sortBy,
  ascending,
}: InferSchema<typeof schema>) {
  const query = buildFieldQuery("title", title, exact);

  const args = buildListArgs({
    fields: "BASIC",
    search: query,
    sortBy,
    ascending,
    limit,
  });

  const output = await runCalibredb(args);

  if (!output) {
    return formatNoBooksFound(title, "title", exact);
  }

  return output;
}
