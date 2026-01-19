import { z } from "zod";
import type { InferSchema } from "xmcp";

import { runCalibredb } from "../utils/calibredb";
import { assertWriteEnabled } from "../config";

export const schema = {
  query: z
    .string()
    .min(1)
    .describe(
      "Calibre search query to find books to retag. Examples: 'author:Sanderson', 'tag:fiction', 'series:Cosmere'."
    ),
  action: z
    .enum(["add", "remove", "replace"])
    .describe(
      "Action to perform: 'add' tags to existing, 'remove' specific tags, 'replace' old tag with new."
    ),
  tags: z
    .string()
    .min(1)
    .describe(
      "Tags to add/remove (comma-separated). For 'replace' action, format as 'old_tag:new_tag'."
    ),
  preview: z
    .boolean()
    .default(true)
    .describe(
      "If true (default), only show what would be changed. Set to false to apply changes."
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(100)
    .default(50)
    .describe("Maximum books to process (default: 50)."),
};

export const metadata = {
  name: "bulk_retag",
  description:
    "Add, remove, or replace tags for books matching a search query. Useful for bulk organization tasks like categorizing all books by an author or cleaning up tag names.",
  annotations: {
    title: "Bulk retag",
    idempotentHint: false,
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: false,
  },
};

interface Book {
  id: number;
  title: string;
  authors: string;
  tags: string;
}

interface RetagResult {
  book: Book;
  currentTags: string[];
  newTags: string[];
  changed: boolean;
}

async function getBooks(query: string, limit: number): Promise<Book[]> {
  const output = await runCalibredb([
    "list",
    "--fields",
    "id,title,authors,tags",
    "--search",
    query,
    "--limit",
    String(limit),
    "--for-machine",
  ]);

  if (!output) return [];

  const books = JSON.parse(output);
  return books.map((b: Record<string, unknown>) => ({
    id: b.id as number,
    title: b.title as string,
    authors: b.authors as string,
    tags: (b.tags as string) || "",
  }));
}

function parseTags(tagString: string): string[] {
  if (!tagString) return [];
  return tagString
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function calculateNewTags(
  currentTags: string[],
  action: "add" | "remove" | "replace",
  tagsParam: string
): string[] {
  const currentSet = new Set(currentTags.map((t) => t.toLowerCase()));
  const currentTagsNormalized = new Map(
    currentTags.map((t) => [t.toLowerCase(), t])
  );

  switch (action) {
    case "add": {
      const tagsToAdd = parseTags(tagsParam);
      const newTags = [...currentTags];

      for (const tag of tagsToAdd) {
        if (!currentSet.has(tag.toLowerCase())) {
          newTags.push(tag);
        }
      }

      return newTags;
    }

    case "remove": {
      const tagsToRemove = new Set(
        parseTags(tagsParam).map((t) => t.toLowerCase())
      );

      return currentTags.filter((t) => !tagsToRemove.has(t.toLowerCase()));
    }

    case "replace": {
      // Format: "old_tag:new_tag" or "old_tag:new_tag, old_tag2:new_tag2"
      const replacements = tagsParam.split(",").map((pair) => {
        const [oldTag, newTag] = pair.split(":").map((s) => s.trim());
        return { old: oldTag?.toLowerCase(), new: newTag };
      });

      const newTags = currentTags.map((tag) => {
        const replacement = replacements.find((r) => r.old === tag.toLowerCase());
        return replacement?.new || tag;
      });

      // Add new tags that weren't replacements of existing ones
      for (const r of replacements) {
        if (r.new && !currentSet.has(r.old) && !newTags.includes(r.new)) {
          // If old tag didn't exist, don't add the new one
        }
      }

      return newTags;
    }
  }
}

function analyzeBooks(
  books: Book[],
  action: "add" | "remove" | "replace",
  tags: string
): RetagResult[] {
  return books.map((book) => {
    const currentTags = parseTags(book.tags);
    const newTags = calculateNewTags(currentTags, action, tags);

    const currentSorted = [...currentTags].sort().join(", ");
    const newSorted = [...newTags].sort().join(", ");

    return {
      book,
      currentTags,
      newTags,
      changed: currentSorted !== newSorted,
    };
  });
}

export default async function bulkRetag({
  query,
  action,
  tags,
  preview,
  limit,
}: InferSchema<typeof schema>): Promise<string> {
  // Validate replace format
  if (action === "replace") {
    const pairs = tags.split(",");
    for (const pair of pairs) {
      if (!pair.includes(":")) {
        return `Invalid replace format. Use 'old_tag:new_tag' format.\nExample: 'sci-fi:Science Fiction' or 'scifi:Science Fiction, fantasy:Fantasy'`;
      }
    }
  }

  // Get matching books
  const books = await getBooks(query, limit);

  if (books.length === 0) {
    return `No books found matching query: "${query}"`;
  }

  // Analyze changes
  const results = analyzeBooks(books, action, tags);
  const needsUpdate = results.filter((r) => r.changed);

  if (needsUpdate.length === 0) {
    const lines = [
      "# Bulk Retag",
      "",
      `**Query:** ${query}`,
      `**Action:** ${action}`,
      `**Tags:** ${tags}`,
      "",
      `✓ No changes needed. All ${books.length} matching books already have the expected tags.`,
    ];

    return lines.join("\n");
  }

  const lines = [
    "# Bulk Retag",
    "",
    `**Query:** ${query}`,
    `**Action:** ${action}`,
    `**Tags:** ${tags}`,
    `**Books found:** ${books.length}`,
    `**Will be updated:** ${needsUpdate.length}`,
    "",
  ];

  if (preview) {
    lines.push("## Preview of Changes");
    lines.push("");
    lines.push(
      "*This is a preview. Set preview: false to apply these changes.*"
    );
    lines.push("");

    for (const result of needsUpdate.slice(0, 20)) {
      lines.push(`### ID ${result.book.id}: ${result.book.title}`);
      lines.push(`- **Current tags:** ${result.currentTags.join(", ") || "(none)"}`);
      lines.push(`- **New tags:** ${result.newTags.join(", ") || "(none)"}`);
      lines.push("");
    }

    if (needsUpdate.length > 20) {
      lines.push(`... and ${needsUpdate.length - 20} more books`);
      lines.push("");
    }

    lines.push("---");
    lines.push("");
    lines.push(
      "To apply these changes, call this tool again with `preview: false`."
    );
    lines.push("");
    lines.push(
      "**Note:** Requires CALIBRE_ENABLE_WRITE_OPERATIONS=true in environment."
    );
  } else {
    // Apply changes
    assertWriteEnabled();

    lines.push("## Applying Changes");
    lines.push("");

    let successCount = 0;
    let errorCount = 0;

    for (const result of needsUpdate) {
      try {
        const newTagsStr = result.newTags.join(", ");

        await runCalibredb([
          "set_metadata",
          String(result.book.id),
          "--field",
          `tags:${newTagsStr}`,
        ]);

        lines.push(`✓ **ID ${result.book.id}:** ${result.book.title}`);
        successCount++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        lines.push(`✗ **ID ${result.book.id}:** Failed - ${msg}`);
        errorCount++;
      }
    }

    lines.push("");
    lines.push("## Summary");
    lines.push("");
    lines.push(`- **Successfully updated:** ${successCount}`);
    if (errorCount > 0) {
      lines.push(`- **Failed:** ${errorCount}`);
    }
  }

  return lines.join("\n");
}
