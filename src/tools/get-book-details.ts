import { z } from "zod";
import type { InferSchema } from "xmcp";

import { runCalibredb } from "../utils/calibredb";

export const schema = {
  bookId: z
    .number()
    .int()
    .positive()
    .describe("The Calibre book ID to retrieve details for."),
};

export const metadata = {
  name: "get_book_details",
  description:
    "Get detailed metadata for a specific book by its Calibre ID. Returns title, authors, tags, formats, identifiers, publication info, and more.",
  annotations: {
    title: "Get book details",
    idempotentHint: true,
    readOnlyHint: true,
    destructiveHint: false,
  },
};

export default async function getBookDetails({
  bookId,
}: InferSchema<typeof schema>) {
  const args = ["show_metadata", String(bookId)];

  const output = await runCalibredb(args);

  if (!output) {
    return `No metadata found for book ID ${bookId}. The book may not exist in the library.`;
  }

  return output;
}
