import { z } from "zod";
import type { InferSchema } from "xmcp";

import { runCalibredb } from "../utils/calibredb";

export const schema = {
  details: z
    .boolean()
    .default(false)
    .describe(
      "If true, include detailed information about each column (data type, display options). Default: false."
    ),
};

export const metadata = {
  name: "get_custom_columns",
  description:
    "List all custom columns defined in the Calibre library. Custom columns allow users to add their own metadata fields (e.g., 'Read Status', 'Owned Format', 'Priority'). Returns column names, labels, and data types.",
  annotations: {
    title: "Get custom columns",
    idempotentHint: true,
    readOnlyHint: true,
    destructiveHint: false,
  },
};

interface CustomColumn {
  name: string;
  label: string;
  datatype: string;
  isMultiple: boolean;
  displayInfo?: Record<string, unknown>;
}

export default async function getCustomColumns({
  details,
}: InferSchema<typeof schema>): Promise<string> {
  const args = ["custom_columns", "--for-machine"];

  if (details) {
    args.push("--details");
  }

  try {
    const output = await runCalibredb(args);

    if (!output) {
      return "No custom columns defined in this library.";
    }

    const columns = JSON.parse(output);

    if (!columns || Object.keys(columns).length === 0) {
      return "No custom columns defined in this library.";
    }

    const parsedColumns: CustomColumn[] = [];

    for (const [name, info] of Object.entries(columns)) {
      const columnInfo = info as Record<string, unknown>;
      parsedColumns.push({
        name: name,
        label: (columnInfo.name as string) || name,
        datatype: (columnInfo.datatype as string) || "unknown",
        isMultiple: Boolean(columnInfo.is_multiple),
        displayInfo: details ? (columnInfo.display as Record<string, unknown>) : undefined,
      });
    }

    // Sort by label for consistent output
    parsedColumns.sort((a, b) => a.label.localeCompare(b.label));

    const lines = [
      `# Custom Columns (${parsedColumns.length})`,
      "",
    ];

    for (const col of parsedColumns) {
      lines.push(`## ${col.label}`);
      lines.push(`- **Column name:** #${col.name}`);
      lines.push(`- **Data type:** ${col.datatype}${col.isMultiple ? " (multiple values)" : ""}`);

      if (details && col.displayInfo) {
        const displayStr = JSON.stringify(col.displayInfo, null, 2);
        lines.push(`- **Display settings:**`);
        lines.push("```json");
        lines.push(displayStr);
        lines.push("```");
      }

      lines.push("");
    }

    // Add usage hint
    lines.push("---");
    lines.push("");
    lines.push("**Usage:** Reference custom columns in searches using `#column_name:value`");
    lines.push("**Example:** `#read_status:\"To Read\"` or `#priority:>3`");

    return lines.join("\n");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Failed to retrieve custom columns: ${errorMessage}`;
  }
}
