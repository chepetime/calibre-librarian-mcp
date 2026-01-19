import { z } from "zod";
import type { InferSchema } from "xmcp";

export const schema = {
  query: z
    .string()
    .optional()
    .describe("What are you looking for? (title, author, topic, etc.)"),
  searchType: z
    .enum(["general", "author", "title", "series", "tag"])
    .default("general")
    .describe("Type of search to perform"),
};

export const metadata = {
  name: "search_library",
  description:
    "Guided search through your Calibre library. Helps find books by title, author, series, tags, or general queries.",
};

export default async function searchLibrary({
  query,
  searchType,
}: InferSchema<typeof schema>) {
  const searchTypeInstructions: Record<string, string> = {
    general: "Search across all fields (title, author, tags, comments, etc.)",
    author: "Search by author name",
    title: "Search by book title",
    series: "Search by series name",
    tag: "Search by tag/category",
  };

  const instruction =
    searchTypeInstructions[searchType] || searchTypeInstructions.general;

  let prompt = `You are helping the user search their Calibre ebook library.

Search type: ${searchType} - ${instruction}
${query ? `User query: "${query}"` : "No specific query provided - help the user explore their library."}

Instructions:
1. Use the list_sample_books tool to show some books if no query is provided
2. For searches, use calibredb search syntax when available
3. Present results in a clear, organized format
4. Offer to provide more details about any book the user is interested in
5. Suggest related searches or filters that might help narrow down results`;

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
