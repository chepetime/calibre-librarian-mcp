# Calibre Librarian MCP Server

Model Context Protocol (MCP) server that surfaces your Calibre catalog to Claude via xmcp.

[![MCP](https://github.com/chepetime/calibre-librarian-mcp/actions/workflows/mcp.yml/badge.svg)](https://github.com/chepetime/calibre-librarian-mcp/actions/workflows/mcp.yml)

## Prerequisites

- **Node.js**: `v24.13.0` (auto-managed if you use `nvm use`).
- **pnpm**: version `10.28.0` or newer.
- **Calibre CLI tools**: `calibredb` and `ebook-convert` must be installable on your PATH.
- **Environment variables**:
  - `CALIBRE_LIBRARY_PATH` – absolute path to your Calibre library directory.
  - `CALIBRE_DB_COMMAND` – location of the `calibredb` executable (e.g., `/opt/homebrew/bin/calibredb`).
  - `FAVORITE_SEARCH_ENGINE_URL` – base URL used when the server offers external book lookups (defaults to DuckDuckGo: `https://duckduckgo.com/?q=`).

## Installation

1. Clone and enter the repo:

   ```bash
   git clone https://github.com/chepetime/calibre-librarian-mcp.git
   cd calibre-librarian-mcp
   ```

2. Install dependencies with pnpm:

   ```bash
   pnpm install
   ```

3. Copy the sample environment file and fill in your paths:

   ```bash
   cp .env.example .env
   ```

   Update the variables so the server can reach your Calibre library.

## Build & Run

- **Type check / lint**: `pnpm run lint`
- **Build**: `pnpm run build` (outputs to `dist/`)
- **Dev mode**: `pnpm run dev` (watches files and serves MCP over stdio)
- **Start built server**: `pnpm start` (runs `node dist/stdio.js`)

## Configure Claude Desktop

Add the server to `~/Library/Application Support/Claude/mcp.json` (or via the in-app UI). Update the `command`, `args`, and `env` paths to match your machine:

```json
{
  "globalShortcut": "",
  "mcpServers": {
    "calibre-librarian": {
      "command": "node",
      "env": {
        "CALIBRE_LIBRARY_PATH": "<Absolute path to your>/Calibre",
        "CALIBRE_DB_COMMAND": "/opt/homebrew/bin/calibredb",
        "FAVORITE_SEARCH_ENGINE_URL": "https://duckduckgo.com/?q="
      }
    }
  },
  "preferences": {
    "quickEntryShortcut": "off",
    "menuBarEnabled": false
  }
}
```

After the config reloads, Claude Desktop will offer the **calibre-librarian** MCP server whenever it launches MCP-enabled conversations.
