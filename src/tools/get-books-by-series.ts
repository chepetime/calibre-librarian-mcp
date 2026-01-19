import { z } from "zod";
import type { InferSchema } from "xmcp";

import { runCalibredb } from "../utils/calibredb";

export const schema = {
  series: z
    .string()
    .min(1)
    .describe(
      "Series name to search for. Partial matches supported (e.g., 'Stormlight' finds 'The Stormlight Archive')."
    ),
  exact: z
    .boolean()
    .default(false)
    .describe(
      "If true, match the exact series name. If false (default), perform a partial/contains search."
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .default(50)
    .describe("Maximum number of results to return (default: 50, max: 100)."),
};

export const metadata = {
  name: "get_books_by_series",
  description:
    "Get all books in a series with proper reading order. Books are sorted by series index to show the correct sequence. Useful for finding what books are in a series and planning reading order.",
  annotations: {
    title: "Get books by series",
    idempotentHint: true,
    readOnlyHint: true,
    destructiveHint: false,
  },
};

export default async function getBooksBySeries({
  series,
  exact,
  limit,
}: InferSchema<typeof schema>): Promise<string> {
  // Build the Calibre query
  // ~pattern means "contains" in Calibre search
  // =pattern means "equals" (exact match)
  const query = exact ? `series:"=${series}"` : `series:"~${series}"`;

  const args = [
    "list",
    "--fields",
    "id,title,authors,series,series_index,tags,formats",
    "--search",
    query,
    "--sort-by",
    "series_index",
    "--ascending",
    "--limit",
    String(limit),
  ];

  const output = await runCalibredb(args);

  if (!output) {
    return exact
      ? `No books found in series: "${series}"`
      : `No books found matching series: "${series}"`;
  }

  // Add a header to the output
  const header = exact
    ? `# Books in "${series}" series (reading order)`
    : `# Books matching series "${series}" (reading order)`;

  return `${header}\n\n${output}`;
}
