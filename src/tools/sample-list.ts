import { z } from "zod";
import type { InferSchema } from "xmcp";

import { runCalibredb } from "../utils/calibredb";

export const schema = {
  limit: z
    .number()
    .int()
    .positive()
    .max(50)
    .default(5)
    .describe("Maximum number of rows to return from the Calibre library."),
};

export const metadata = {
  name: "list_sample_books",
  description:
    "List a few books from the configured Calibre library using calibredb list.",
  annotations: {
    title: "List sample books",
    idempotentHint: true,
    readOnlyHint: true,
    destructiveHint: false,
  },
};

export default async function listSampleBooks({
  limit,
}: InferSchema<typeof schema>) {
  const args = [
    "list",
    "--fields",
    "id,title,authors",
    "--sort-by",
    "title",
    "--ascending",
    "--limit",
    String(limit),
  ];

  const output = await runCalibredb(args);
  return output || "No books returned by calibredb list.";
}
