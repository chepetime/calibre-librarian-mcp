import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const envSchema = z.object({
  CALIBRE_LIBRARY_PATH: z
    .string()
    .describe("Filesystem path to the Calibre library directory")
    .min(1, "Set CALIBRE_LIBRARY_PATH to the directory containing metadata.db"),
  CALIBRE_DB_COMMAND: z
    .string()
    .describe("Executable or absolute path to calibredb")
    .default("calibredb"),
  MCP_SERVER_NAME: z
    .string()
    .describe("Friendly name shown in MCP clients")
    .default("Calibre Librarian MCP"),
  CALIBRE_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
  CALIBRE_ENABLE_WRITE_OPERATIONS: z
    .string()
    .transform((val) => val.toLowerCase() === "true" || val === "1")
    .default("false")
    .describe(
      "Enable write operations (set_metadata, set_custom_column). Disabled by default for safety."
    ),
  FAVORITE_SEARCH_ENGINE_URL: z
    .string()
    .url()
    .describe(
      "Base URL for external book search when titles are missing from Calibre"
    )
    .default("https://duckduckgo.com/?q="),
});

const parsedEnv = envSchema.parse({
  CALIBRE_LIBRARY_PATH: process.env.CALIBRE_LIBRARY_PATH,
  CALIBRE_DB_COMMAND: process.env.CALIBRE_DB_COMMAND,
  MCP_SERVER_NAME: process.env.MCP_SERVER_NAME,
  CALIBRE_COMMAND_TIMEOUT_MS: process.env.CALIBRE_COMMAND_TIMEOUT_MS,
  FAVORITE_SEARCH_ENGINE_URL: process.env.FAVORITE_SEARCH_ENGINE_URL,
});

export const config = {
  calibreLibraryPath: parsedEnv.CALIBRE_LIBRARY_PATH,
  calibredbCommand: parsedEnv.CALIBRE_DB_COMMAND,
  serverName: parsedEnv.MCP_SERVER_NAME,
  commandTimeoutMs: parsedEnv.CALIBRE_COMMAND_TIMEOUT_MS,
  favoriteSearchEngineUrl: parsedEnv.FAVORITE_SEARCH_ENGINE_URL,
} as const;
