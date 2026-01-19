import { z } from "zod";
import type { InferSchema } from "xmcp";

import { runCalibredb } from "../utils/calibredb";

export const schema = {
  pattern: z
    .string()
    .min(1)
    .describe(
      "Tag pattern to search for. Case-insensitive partial match (e.g., 'sci' matches 'Science Fiction', 'Sci-Fi')."
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .default(50)
    .describe("Maximum number of book results to return (default: 50, max: 100)."),
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
  name: "search_books_by_tag_pattern",
  description:
    "Search for books by tag pattern. First finds all tags matching the pattern, then returns books with any of those tags. Useful for exploring related categories (e.g., 'fiction' finds books tagged 'Fiction', 'Science Fiction', 'Historical Fiction', etc.).",
  annotations: {
    title: "Search books by tag pattern",
    idempotentHint: true,
    readOnlyHint: true,
    destructiveHint: false,
  },
};

interface TagInfo {
  name: string;
  count: number;
}

async function findMatchingTags(pattern: string): Promise<TagInfo[]> {
  const output = await runCalibredb(["list_categories", "--for-machine"]);

  if (!output) {
    return [];
  }

  const categories = JSON.parse(output);
  const tagsData = categories.tags;

  if (!tagsData || !Array.isArray(tagsData)) {
    return [];
  }

  const searchPattern = pattern.toLowerCase();
  return tagsData
    .filter(
      (item: { name?: string; count?: number }) =>
        item.name &&
        typeof item.count === "number" &&
        item.name.toLowerCase().includes(searchPattern)
    )
    .map((item: { name: string; count: number }) => ({
      name: item.name,
      count: item.count,
    }))
    .sort((a: TagInfo, b: TagInfo) => b.count - a.count);
}

export default async function searchBooksByTagPattern({
  pattern,
  limit,
  sortBy,
  ascending,
}: InferSchema<typeof schema>): Promise<string> {
  // First, find all tags matching the pattern
  const matchingTags = await findMatchingTags(pattern);

  if (matchingTags.length === 0) {
    return `No tags found matching pattern: "${pattern}"`;
  }

  // Build a query that matches any of the found tags
  // Use OR to combine multiple tag searches
  const tagQueries = matchingTags.map((tag) => `tag:"=${tag.name}"`);
  const query = tagQueries.join(" or ");

  const args = [
    "list",
    "--fields",
    "id,title,authors,tags,series,formats",
    "--search",
    query,
    "--sort-by",
    sortBy,
    "--limit",
    String(limit),
  ];

  if (ascending) {
    args.push("--ascending");
  }

  const output = await runCalibredb(args);

  // Build the response with matching tags info
  const lines = [
    `# Books matching tag pattern "${pattern}"`,
    "",
    `**Matching tags (${matchingTags.length}):**`,
  ];

  for (const tag of matchingTags.slice(0, 10)) {
    lines.push(`- ${tag.name} (${tag.count} books)`);
  }

  if (matchingTags.length > 10) {
    lines.push(`- ... and ${matchingTags.length - 10} more tags`);
  }

  lines.push("");

  if (!output) {
    lines.push("No books found with these tags.");
  } else {
    lines.push("**Books:**", "", output);
  }

  return lines.join("\n");
}
