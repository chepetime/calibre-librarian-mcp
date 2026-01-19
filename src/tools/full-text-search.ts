import { z } from "zod";
import type { InferSchema } from "xmcp";

import { runCalibredb } from "../utils/calibredb";

export const schema = {
  query: z
    .string()
    .min(1)
    .describe(
      "Full-text search query. Searches inside book content, not just metadata. Supports phrases in quotes."
    ),
  matchAll: z
    .boolean()
    .default(false)
    .describe(
      "If true, all words must match. If false (default), any word can match."
    ),
  includeSnippets: z
    .boolean()
    .default(true)
    .describe(
      "If true (default), include text snippets showing where matches were found."
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(50)
    .default(20)
    .describe("Maximum number of results to return (default: 20, max: 50)."),
};

export const metadata = {
  name: "full_text_search",
  description:
    "Search inside book content using Calibre's full-text search. Finds quotes, passages, and references within books. Note: Requires FTS indexing to be enabled in Calibre library settings.",
  annotations: {
    title: "Full-text search",
    idempotentHint: true,
    readOnlyHint: true,
    destructiveHint: false,
  },
};

export default async function fullTextSearch({
  query,
  matchAll,
  includeSnippets,
  limit,
}: InferSchema<typeof schema>): Promise<string> {
  const args = ["fts_search"];

  if (matchAll) {
    args.push("--match-all");
  }

  if (!includeSnippets) {
    args.push("--do-not-output-snippets");
  }

  args.push("--limit", String(limit));
  args.push(query);

  try {
    const output = await runCalibredb(args);

    if (!output) {
      return `No results found for: "${query}"\n\nNote: Full-text search requires FTS indexing to be enabled in your Calibre library. You can enable it in Calibre preferences under "Searching" > "Full text searching".`;
    }

    const header = `# Full-text search results for "${query}"`;
    return `${header}\n\n${output}`;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for common FTS-related errors
    if (
      errorMessage.includes("FTS") ||
      errorMessage.includes("full text") ||
      errorMessage.includes("not indexed")
    ) {
      return `Full-text search is not available.\n\n**To enable FTS:**\n1. Open Calibre\n2. Go to Preferences > Searching\n3. Enable "Full text searching"\n4. Click "Re-index all books"\n\nError: ${errorMessage}`;
    }

    throw error;
  }
}
