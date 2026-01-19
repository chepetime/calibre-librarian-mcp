import { z } from "zod";
import type { InferSchema } from "xmcp";

import { runCalibredb } from "../utils/calibredb";

export const schema = {
  name: z
    .string()
    .min(1)
    .describe(
      "Author name pattern to search for. Case-insensitive partial match (e.g., 'sanderson' finds 'Brandon Sanderson')."
    ),
  sortBy: z
    .enum(["name", "count"])
    .default("count")
    .describe("Sort results by name (alphabetical) or count (most books first, default)."),
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .default(25)
    .describe("Maximum number of results to return (default: 25, max: 100)."),
};

export const metadata = {
  name: "search_authors_by_name",
  description:
    "Search for authors by name pattern. Returns matching authors with their book counts. Useful for finding authors when you only remember part of their name.",
  annotations: {
    title: "Search authors by name",
    idempotentHint: true,
    readOnlyHint: true,
    destructiveHint: false,
  },
};

interface AuthorInfo {
  id: number;
  name: string;
  count: number;
}

export default async function searchAuthorsByName({
  name,
  sortBy,
  limit,
}: InferSchema<typeof schema>): Promise<string> {
  const output = await runCalibredb(["list_categories", "--for-machine"]);

  if (!output) {
    return "Could not retrieve author information from the library.";
  }

  const categories = JSON.parse(output);
  const authorsData = categories.authors;

  if (!authorsData || !Array.isArray(authorsData) || authorsData.length === 0) {
    return "No authors found in the library.";
  }

  // Filter authors by name pattern (case-insensitive)
  const searchPattern = name.toLowerCase();
  let matchingAuthors: AuthorInfo[] = authorsData
    .filter(
      (item: { name?: string; id?: number; count?: number }) =>
        item.name &&
        typeof item.id === "number" &&
        typeof item.count === "number" &&
        item.name.toLowerCase().includes(searchPattern)
    )
    .map((item: { name: string; id: number; count: number }) => ({
      id: item.id,
      name: item.name,
      count: item.count,
    }));

  if (matchingAuthors.length === 0) {
    return `No authors found matching "${name}".`;
  }

  // Sort results
  if (sortBy === "name") {
    matchingAuthors.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    matchingAuthors.sort((a, b) => b.count - a.count);
  }

  // Apply limit
  const totalMatches = matchingAuthors.length;
  matchingAuthors = matchingAuthors.slice(0, limit);

  // Format output
  const lines = [
    `# Authors matching "${name}"`,
    "",
    `Found ${totalMatches} author${totalMatches === 1 ? "" : "s"}${totalMatches > limit ? ` (showing first ${limit})` : ""}`,
    "",
  ];

  for (const author of matchingAuthors) {
    lines.push(
      `- **${author.name}** (ID: ${author.id}): ${author.count} book${author.count === 1 ? "" : "s"}`
    );
  }

  return lines.join("\n");
}
