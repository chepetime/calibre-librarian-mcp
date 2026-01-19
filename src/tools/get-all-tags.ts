import { z } from "zod";
import type { InferSchema } from "xmcp";

import { runCalibredb } from "../utils/calibredb";

export const schema = {
  sortBy: z
    .enum(["name", "count"])
    .default("name")
    .describe("Sort tags by name (alphabetical) or count (most used first)."),
  minCount: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Only show tags with at least this many books (default: 0, show all)."),
};

export const metadata = {
  name: "get_all_tags",
  description:
    "List all tags in the Calibre library with book counts. Useful for exploring available categories, finding popular tags, or planning tag-based organization.",
  annotations: {
    title: "Get all tags",
    idempotentHint: true,
    readOnlyHint: true,
    destructiveHint: false,
  },
};

interface TagInfo {
  name: string;
  count: number;
}

export default async function getAllTags({
  sortBy,
  minCount,
}: InferSchema<typeof schema>): Promise<string> {
  const output = await runCalibredb(["list_categories", "--for-machine"]);

  if (!output) {
    return "No tags found in the library.";
  }

  const categories = JSON.parse(output);
  const tagsData = categories.tags;

  if (!tagsData || !Array.isArray(tagsData) || tagsData.length === 0) {
    return "No tags found in the library.";
  }

  // Extract and filter tags
  let tags: TagInfo[] = tagsData
    .filter(
      (item: { name?: string; count?: number }) =>
        item.name && typeof item.count === "number"
    )
    .map((item: { name: string; count: number }) => ({
      name: item.name,
      count: item.count,
    }))
    .filter((tag: TagInfo) => tag.count >= minCount);

  // Sort tags
  if (sortBy === "name") {
    tags.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    tags.sort((a, b) => b.count - a.count);
  }

  if (tags.length === 0) {
    return minCount > 0
      ? `No tags found with at least ${minCount} books.`
      : "No tags found in the library.";
  }

  // Format output
  const lines = [
    `# All Tags (${tags.length} total)`,
    "",
    `Sorted by: ${sortBy === "name" ? "alphabetical" : "book count"}`,
    minCount > 0 ? `Minimum books: ${minCount}` : "",
    "",
  ].filter(Boolean);

  for (const tag of tags) {
    lines.push(`- **${tag.name}**: ${tag.count} book${tag.count === 1 ? "" : "s"}`);
  }

  return lines.join("\n");
}
