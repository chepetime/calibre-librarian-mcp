import { z } from "zod";
import type { InferSchema } from "xmcp";

import { runCalibredb } from "../utils/calibredb";
import { buildListArgs } from "../utils/query";
import { formatNoResults } from "../utils/response";

export const schema = {
  query: z
    .string()
    .min(1)
    .describe(
      "Search query using Calibre's query language. Examples: 'title:\"lord of the rings\"', 'author:Sanderson', 'tag:fiction', 'series:cosmere', or combine with 'and'/'or': 'author:Tolkien and tag:fantasy'."
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
  name: "search_books",
  description:
    "Search books in the Calibre library using Calibre's query language. Supports field-specific searches (title:, author:, tag:, series:, publisher:, format:, rating:, etc.) and boolean operators (and, or, not).",
  annotations: {
    title: "Search books",
    idempotentHint: true,
    readOnlyHint: true,
    destructiveHint: false,
  },
};

export default async function searchBooks({
  query,
  limit,
  sortBy,
  ascending,
}: InferSchema<typeof schema>) {
  const args = buildListArgs({
    fields: "BASIC",
    search: query,
    sortBy,
    ascending,
    limit,
  });

  const output = await runCalibredb(args);

  if (!output) {
    return formatNoResults({ entityType: "books", query });
  }

  return output;
}
