import { z } from "zod";
import type { InferSchema } from "xmcp";
import { platform, homedir } from "node:os";
import { join } from "node:path";

import { config } from "../config";

export const schema = {
  libraryPath: z
    .string()
    .optional()
    .describe(
      "Calibre library path. If not provided, uses current CALIBRE_LIBRARY_PATH."
    ),
  enableWrites: z
    .boolean()
    .default(false)
    .describe("Enable write operations in the generated config."),
  serverPath: z
    .string()
    .optional()
    .describe(
      "Path to the MCP server entry point. If not provided, attempts to detect it."
    ),
};

export const metadata = {
  name: "generate_claude_config",
  description:
    "Generate Claude Desktop configuration for this MCP server. Outputs the JSON snippet to add to your Claude Desktop config file.",
  annotations: {
    title: "Generate Claude config",
    idempotentHint: true,
    readOnlyHint: true,
    destructiveHint: false,
  },
};

interface ClaudeConfig {
  mcpServers: {
    [key: string]: {
      command: string;
      args: string[];
      env?: Record<string, string>;
    };
  };
}

function getConfigPath(): string {
  const os = platform();

  switch (os) {
    case "darwin":
      return join(
        homedir(),
        "Library",
        "Application Support",
        "Claude",
        "claude_desktop_config.json"
      );
    case "win32":
      return join(
        process.env.APPDATA || join(homedir(), "AppData", "Roaming"),
        "Claude",
        "claude_desktop_config.json"
      );
    case "linux":
      return join(
        process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
        "Claude",
        "claude_desktop_config.json"
      );
    default:
      return "~/.config/Claude/claude_desktop_config.json";
  }
}

function detectServerPath(): string {
  // Try to detect the server path based on common patterns
  const cwd = process.cwd();

  // Check if we're running from a built dist folder
  if (cwd.includes("dist")) {
    return join(cwd, "stdio.js");
  }

  // Default to dist/stdio.js relative to project root
  return join(cwd, "dist", "stdio.js");
}

function detectCalibredbPath(): string {
  const os = platform();

  switch (os) {
    case "darwin":
      // macOS: Homebrew or Applications
      return "/opt/homebrew/bin/calibredb";
    case "win32":
      // Windows: Default install location
      return "C:\\Program Files\\Calibre2\\calibredb.exe";
    case "linux":
      // Linux: Usually in PATH
      return "calibredb";
    default:
      return "calibredb";
  }
}

export default async function generateClaudeConfig({
  libraryPath,
  enableWrites,
  serverPath,
}: InferSchema<typeof schema>): Promise<string> {
  const effectiveLibraryPath = libraryPath || config.calibreLibraryPath;
  const effectiveServerPath = serverPath || detectServerPath();
  const calibredbPath = detectCalibredbPath();

  const serverConfig: ClaudeConfig = {
    mcpServers: {
      "calibre-librarian": {
        command: "node",
        args: [effectiveServerPath],
        env: {
          CALIBRE_LIBRARY_PATH: effectiveLibraryPath,
          CALIBRE_DB_COMMAND: calibredbPath,
          ...(enableWrites
            ? { CALIBRE_ENABLE_WRITE_OPERATIONS: "true" }
            : {}),
        },
      },
    },
  };

  const configPath = getConfigPath();
  const os = platform();

  const lines = [
    "# Claude Desktop Configuration",
    "",
    "Add the following to your Claude Desktop config file:",
    "",
    `**Config file location:** \`${configPath}\``,
    "",
    "## Configuration JSON",
    "",
    "```json",
    JSON.stringify(serverConfig, null, 2),
    "```",
    "",
    "## Setup Instructions",
    "",
    "1. **Build the server** (if not already done):",
    "   ```bash",
    "   npm run build",
    "   ```",
    "",
    "2. **Open the Claude Desktop config file:**",
  ];

  if (os === "darwin") {
    lines.push(
      "   ```bash",
      `   open "${configPath}"`,
      "   # Or create it if it doesn't exist:",
      `   mkdir -p "$(dirname '${configPath}')"`,
      `   touch "${configPath}"`,
      "   ```"
    );
  } else if (os === "win32") {
    lines.push(
      "   Open File Explorer and navigate to:",
      `   \`${configPath}\``,
      "",
      "   Create the file if it doesn't exist."
    );
  } else {
    lines.push(
      "   ```bash",
      `   mkdir -p "$(dirname '${configPath}')"`,
      `   nano "${configPath}"`,
      "   ```"
    );
  }

  lines.push(
    "",
    "3. **Add the configuration:**",
    "   - If the file is empty, paste the entire JSON above",
    "   - If the file has existing config, merge the `mcpServers` section",
    "",
    "4. **Restart Claude Desktop** to load the new configuration",
    "",
    "## Verification",
    "",
    "After restarting Claude Desktop, you should see the Calibre Librarian",
    "tools available. Try asking Claude to list some books from your library.",
    "",
    "## Troubleshooting",
    "",
    "- **Server not found:** Make sure you've run `npm run build`",
    `- **Library not found:** Verify the path exists: \`${effectiveLibraryPath}\``,
    `- **calibredb not found:** Check the path: \`${calibredbPath}\``,
    "- **Check logs:** Claude Desktop logs are in the same directory as the config",
    ""
  );

  if (!enableWrites) {
    lines.push(
      "## Note on Write Operations",
      "",
      "Write operations are disabled by default for safety.",
      "To enable editing metadata, add to the env section:",
      "```json",
      '"CALIBRE_ENABLE_WRITE_OPERATIONS": "true"',
      "```",
      ""
    );
  }

  return lines.join("\n");
}
