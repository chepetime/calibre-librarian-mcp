# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Calibre Librarian MCP is a TypeScript Model Context Protocol server that connects MCP clients (Claude Desktop, VS Code, etc.) to a local Calibre ebook library. It wraps the `calibredb` CLI to expose metadata inspection, full-text search, and library maintenance operations.

## Commands

```bash
npm run dev      # Start xmcp development server with hot reload
npm run build    # Build to dist/ via xmcp
npm run start    # Run built server (dist/stdio.js)
npm run lint     # Type-check with tsc --noEmit
```

## Environment Configuration

Required environment variable (can be set in `.env`):
- `CALIBRE_LIBRARY_PATH` – Path to Calibre library directory containing `metadata.db`

Optional:
- `CALIBRE_DB_COMMAND` – Path to calibredb executable (default: `calibredb`)
- `MCP_SERVER_NAME` – Server name shown in clients (default: `Calibre Librarian MCP`)
- `CALIBRE_COMMAND_TIMEOUT_MS` – Command timeout in ms (default: `15000`)

## Architecture

This project uses **xmcp** as the MCP framework. The `xmcp.config.ts` file defines paths for auto-discovery of tools, prompts, and resources.

### File Conventions (xmcp pattern)

Each tool/prompt/resource is a single file that exports:
- `schema` – Zod schema defining input parameters
- `metadata` – Name, description, and annotations
- `default function` – The handler implementation

**Tools** (`src/tools/`) – MCP tools that clients can invoke. Use `InferSchema<typeof schema>` for typed parameters.

**Prompts** (`src/prompts/`) – Pre-defined prompt templates with optional arguments. Return `{ messages: [...] }`.

**Resources** (`src/resources/`) – Static or semi-static data exposed via URIs. Return `{ contents: [...] }`.

### Core Utilities

- `src/config.ts` – Zod-validated environment config, imported as `config`
- `src/utils/calibredb.ts` – `runCalibredb(args)` wrapper that spawns calibredb with library path and timeout handling

### Adding a New Tool

1. Create `src/tools/myTool.ts`
2. Export `schema`, `metadata`, and default async handler
3. The tool is auto-registered by xmcp on next dev/build

## Scope

Current milestone focuses on read operations: listing books, searching metadata, full-text discovery, and enumerating custom columns. Write operations (updating custom columns) are planned but guarded.

Out of scope: authentication, remote deployment, serving book files, GUI/CLI frontends.
