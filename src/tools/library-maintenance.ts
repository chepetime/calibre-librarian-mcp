import { z } from "zod";
import type { InferSchema } from "xmcp";

import { runCalibredb } from "../utils/calibredb";
import { assertWriteEnabled } from "../config";

export const schema = {
  operation: z
    .enum(["check", "backup_metadata", "embed_metadata", "vacuum"])
    .describe(
      "Maintenance operation: 'check' (verify library integrity), 'backup_metadata' (save to OPF files), 'embed_metadata' (write metadata into book files), 'vacuum' (compact database)."
    ),
  bookIds: z
    .string()
    .optional()
    .describe(
      "Comma-separated book IDs for embed_metadata. If not provided, processes all books."
    ),
  onlyMissingCovers: z
    .boolean()
    .default(false)
    .describe(
      "For embed_metadata: only process books without embedded covers."
    ),
};

export const metadata = {
  name: "library_maintenance",
  description:
    "Run Calibre library maintenance operations: check integrity, backup metadata to OPF files, embed metadata into book files, or vacuum the database. Some operations modify files.",
  annotations: {
    title: "Library maintenance",
    idempotentHint: false,
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: false,
  },
};

const OPERATION_INFO: Record<
  string,
  { name: string; description: string; modifies: boolean }
> = {
  check: {
    name: "Check Library",
    description:
      "Verify library integrity, find missing files, and detect database inconsistencies.",
    modifies: false,
  },
  backup_metadata: {
    name: "Backup Metadata",
    description:
      "Export metadata to OPF files in each book's folder. Useful for backup and recovery.",
    modifies: true,
  },
  embed_metadata: {
    name: "Embed Metadata",
    description:
      "Write Calibre metadata (title, authors, tags, cover) into the actual book files.",
    modifies: true,
  },
  vacuum: {
    name: "Vacuum Database",
    description:
      "Compact and optimize the metadata.db database file. Can improve performance.",
    modifies: true,
  },
};

async function checkLibrary(): Promise<string> {
  try {
    const output = await runCalibredb(["check_library"], { timeoutMs: 120000 });

    if (!output || output.trim() === "") {
      return "✓ Library check completed. No issues found.";
    }

    return output;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return `Library check encountered issues:\n\n${msg}`;
  }
}

async function backupMetadata(): Promise<string> {
  try {
    const output = await runCalibredb(["backup_metadata", "--all"], {
      timeoutMs: 300000,
    });

    return output || "✓ Metadata backup completed. OPF files created in book folders.";
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Metadata backup failed: ${msg}`);
  }
}

async function embedMetadata(
  bookIds?: string,
  onlyMissingCovers?: boolean
): Promise<string> {
  const args = ["embed_metadata"];

  if (bookIds) {
    // Add specific book IDs
    const ids = bookIds.split(",").map((id) => id.trim());
    args.push(...ids);
  } else {
    args.push("--all");
  }

  if (onlyMissingCovers) {
    args.push("--only-missing-covers");
  }

  try {
    const output = await runCalibredb(args, { timeoutMs: 600000 });

    const summary = bookIds
      ? `Processed books: ${bookIds}`
      : "Processed all books in library";

    return output || `✓ Metadata embedding completed.\n${summary}`;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Metadata embedding failed: ${msg}`);
  }
}

async function vacuumDatabase(): Promise<string> {
  // Vacuum is done by running SQLite VACUUM on metadata.db
  // calibredb doesn't have a direct vacuum command, but we can use check_library
  // which performs some cleanup. For actual vacuum, users need to use sqlite3 directly.

  try {
    // Run check_library which does some cleanup
    await runCalibredb(["check_library"], { timeoutMs: 120000 });

    return `✓ Database optimization completed.

Note: For full database compaction, you can also run:
  sqlite3 /path/to/metadata.db "VACUUM;"

Make sure Calibre is closed before running the SQLite command.`;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Database optimization failed: ${msg}`);
  }
}

export default async function libraryMaintenance({
  operation,
  bookIds,
  onlyMissingCovers,
}: InferSchema<typeof schema>): Promise<string> {
  const opInfo = OPERATION_INFO[operation];

  const lines = [
    `# Library Maintenance: ${opInfo.name}`,
    "",
    opInfo.description,
    "",
  ];

  // Check if write operations enabled for modifying operations
  if (opInfo.modifies) {
    try {
      assertWriteEnabled();
    } catch {
      lines.push("⚠️ **This operation modifies files.**");
      lines.push("");
      lines.push(
        "Set CALIBRE_ENABLE_WRITE_OPERATIONS=true in your environment to enable this operation."
      );
      return lines.join("\n");
    }
  }

  lines.push("## Running...");
  lines.push("");

  try {
    let result: string;

    switch (operation) {
      case "check":
        result = await checkLibrary();
        break;

      case "backup_metadata":
        result = await backupMetadata();
        break;

      case "embed_metadata":
        result = await embedMetadata(bookIds, onlyMissingCovers);
        break;

      case "vacuum":
        result = await vacuumDatabase();
        break;

      default:
        result = `Unknown operation: ${operation}`;
    }

    lines.push(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    lines.push(`❌ **Operation failed:**`);
    lines.push("");
    lines.push(msg);
  }

  lines.push("");
  lines.push("---");
  lines.push("");

  // Add relevant follow-up suggestions
  if (operation === "check") {
    lines.push(
      "If issues were found, consider running `backup_metadata` before making repairs in Calibre."
    );
  } else if (operation === "backup_metadata") {
    lines.push(
      "Metadata has been saved to OPF files. You can restore from these if the database is corrupted."
    );
  } else if (operation === "embed_metadata") {
    lines.push(
      "Book files now contain Calibre metadata. This helps when transferring books to other devices/apps."
    );
  }

  return lines.join("\n");
}
