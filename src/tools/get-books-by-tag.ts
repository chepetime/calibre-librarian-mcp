import { z } from "zod";
import type { InferSchema } from "xmcp";

import { runCalibredb } from "../utils/calibredb";
import { buildFieldQuery, buildListArgs } from "../utils/query";
import { formatNoBooksFound } from "../utils/response";

export const schema = {
  tag: z
    .string()
    .min(1)
    .describe(
      "Tag to search for. Use get_all_tags to see available tags in your library."
    ),
  exact: z
    .boolean()
    .default(true)
    .describe(
      "If true (default), match the exact tag. If false, perform a partial/contains search."
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .default(50)
    .describe("Maximum number of results to return (default: 50, max: 100)."),
  sortBy: z
    .enum(["title", "authors", "pubdate", "timestamp", "rating"])
    .default("title")
    .describe("Field to sort results by (default: title)."),
  ascending: z
    .boolean()
    .default(true)
    .describe("Sort in ascending order (default: true)."),
};

export const metadata = {
  name: "get_books_by_tag",
  description:
    "Get all books with a specific tag. Useful for browsing themed collections or finding books in a category. Use get_all_tags to discover available tags first.",
  annotations: {
    title: "Get books by tag",
    idempotentHint: true,
    readOnlyHint: true,
    destructiveHint: false,
  },
};

export default async function getBooksByTag({
  tag,
  exact,
  limit,
  sortBy,
  ascending,
}: InferSchema<typeof schema>): Promise<string> {
  const query = buildFieldQuery("tag", tag, exact);

  const args = buildListArgs({
    fields: "id,title,authors,tags,series,series_index,formats",
    search: query,
    sortBy,
    ascending,
    limit,
  });

  const output = await runCalibredb(args);

  if (!output) {
    return formatNoBooksFound(tag, "tag", exact);
  }

  // Add a header to the output
  const header = exact
    ? `# Books tagged "${tag}"`
    : `# Books matching tag pattern "${tag}"`;

  return `${header}\n\n${output}`;
}
