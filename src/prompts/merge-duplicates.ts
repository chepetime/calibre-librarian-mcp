import { z } from "zod";
import type { InferSchema } from "xmcp";

export const schema = {
  bookIds: z
    .string()
    .optional()
    .describe(
      "Comma-separated list of book IDs to merge (e.g., '123, 456'). If not provided, will scan for duplicates first."
    ),
  keepId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "ID of the book to keep as the primary. If not provided, will help decide."
    ),
};

export const metadata = {
  name: "merge_duplicates",
  description:
    "Guided workflow for handling duplicate books. Helps compare duplicates, decide which to keep, merge metadata/tags, and safely remove extras.",
};

export default async function mergeDuplicates({
  bookIds,
  keepId,
}: InferSchema<typeof schema>) {
  let contextInfo = "";

  if (bookIds) {
    contextInfo = `The user has identified these book IDs as potential duplicates: ${bookIds}`;
    if (keepId) {
      contextInfo += `\nThey want to keep book ID ${keepId} as the primary.`;
    }
  } else {
    contextInfo =
      "The user wants to find and handle duplicate books in their library.";
  }

  const prompt = `You are helping the user merge duplicate books in their Calibre library.

${contextInfo}

## Workflow Steps

### Step 1: Identify Duplicates
${bookIds ? "- Use `compare_books` to compare the provided book IDs side-by-side" : "- Use `find_duplicates` to scan the library for potential duplicates"}
- Show the user what was found with clear details

### Step 2: Compare & Decide
- If not already compared, use \`compare_books\` with the duplicate IDs
- Highlight key differences: formats, tags, ratings, identifiers
- Help the user decide which book to keep based on:
  - Which has more/better formats (EPUB preferred over PDF)
  - Which has better metadata (more tags, identifiers, description)
  - Which has a rating (if applicable)

### Step 3: Prepare for Merge
Before removing any book, ensure valuable data is preserved:
- **Tags**: If the books have different tags, suggest combining them
- **Formats**: Note if any formats would be lost
- **Custom columns**: Check if any custom column values should be transferred
- **Identifiers**: Note if the duplicate has useful identifiers

### Step 4: Update Primary Book (if needed)
If the book being kept is missing data from the duplicate:
- Use \`set_metadata\` to add missing tags, update ratings, etc.
- Use \`set_custom_column\` for any custom column values

### Step 5: Confirm Removal
- IMPORTANT: Do NOT automatically remove books
- Clearly state which book(s) will be removed
- Ask for explicit confirmation before any destructive action
- Note: Actual deletion requires the user to use Calibre directly (calibredb remove is intentionally not exposed)

## Safety Guidelines
- Always show book details before any action
- Never delete without explicit user confirmation
- Suggest what to preserve before removing anything
- If unsure, ask the user for clarification

## Available Tools
- \`find_duplicates\` - Find potential duplicates
- \`compare_books\` - Side-by-side comparison
- \`get_book_details\` - Full metadata view
- \`set_metadata\` - Update book metadata (requires CALIBRE_ENABLE_WRITE_OPERATIONS=true)
- \`set_custom_column\` - Update custom columns

Start by ${bookIds ? "comparing the provided books" : "scanning for duplicates"}.`;

  return {
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: prompt,
        },
      },
    ],
  };
}
