import { z } from "zod";
import type { InferSchema } from "xmcp";

export const schema = {
  focus: z
    .enum(["duplicates", "missing_metadata", "empty_tags", "all"])
    .default("all")
    .describe("What aspect of library hygiene to focus on"),
};

export const metadata = {
  name: "library_cleanup",
  description:
    "Help identify and fix library hygiene issues like duplicates, missing metadata, or organizational problems.",
};

export default async function libraryCleanup({
  focus,
}: InferSchema<typeof schema>) {
  const focusInstructions: Record<string, string> = {
    duplicates:
      "Look for potential duplicate books (same title/author combinations)",
    missing_metadata:
      "Find books with incomplete metadata (missing authors, tags, descriptions)",
    empty_tags: "Identify books that have no tags or categories assigned",
    all: "Perform a general library health check covering all areas",
  };

  const instruction = focusInstructions[focus] || focusInstructions.all;

  const prompt = `You are helping the user clean up and organize their Calibre ebook library.

Focus area: ${focus} - ${instruction}

Instructions:
1. Start by listing some books to get an overview of the library
2. Identify potential issues based on the focus area
3. Present findings clearly with specific book IDs and titles
4. Suggest specific actions to fix each issue
5. If custom columns are available, check if they can help with organization
6. Be cautious with any modifications - always confirm with the user before making changes

Remember: This is about helping maintain a well-organized library, not just finding problems.
Offer constructive suggestions for improvement.`;

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
