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

## Tool Catalog & Examples

All tools can be invoked from MCP Inspector or the CLI:

```bash
mcp call calibre-librarian <toolName> '<json payload>'
```

Prompts use `mcp prompt` instead of `mcp call`. Replace `calibre-librarian` with the name you configured in `mcp.json`.

### Library Overview & Metadata

| Tool                 | Example                                                                     |
| -------------------- | --------------------------------------------------------------------------- |
| `list_sample_books`  | `mcp call calibre-librarian list_sample_books '{"limit":5}'`                |
| `get_book_details`   | `mcp call calibre-librarian get_book_details '{"bookId":42}'`               |
| `get_library_stats`  | `mcp call calibre-librarian get_library_stats '{}'`                         |
| `get_all_tags`       | `mcp call calibre-librarian get_all_tags '{"sortBy":"count","minCount":5}'` |
| `get_custom_columns` | `mcp call calibre-librarian get_custom_columns '{"includeDisplay":true}'`   |

### Search & Discovery

| Tool                          | Example                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `search_books`                | `mcp call calibre-librarian search_books '{"query":"author:Sanderson and tag:fantasy","limit":10}'`           |
| `search_books_by_title`       | `mcp call calibre-librarian search_books_by_title '{"title":"stormlight","exact":false}'`                     |
| `search_authors_by_name`      | `mcp call calibre-librarian search_authors_by_name '{"name":"ng","sortBy":"count"}'`                          |
| `get_books_by_author`         | `mcp call calibre-librarian get_books_by_author '{"author":"Robin Hobb","sortBy":"series","ascending":true}'` |
| `get_books_by_author_id`      | `mcp call calibre-librarian get_books_by_author_id '{"authorId":17}'`                                         |
| `get_books_by_series`         | `mcp call calibre-librarian get_books_by_series '{"series":"The Expanse","exact":true}'`                      |
| `get_books_by_tag`            | `mcp call calibre-librarian get_books_by_tag '{"tag":"cozy mystery","limit":25}'`                             |
| `search_books_by_tag_pattern` | `mcp call calibre-librarian search_books_by_tag_pattern '{"pattern":"*punk","limit":10}'`                     |

### Full-Text & Content Access

| Tool                  | Example                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| `full_text_search`    | `mcp call calibre-librarian full_text_search '{"query":"\"winter is coming\"","matchAll":false}'`     |
| `search_book_content` | `mcp call calibre-librarian search_book_content '{"bookId":12,"query":"quantum","contextChars":120}'` |
| `fetch_excerpt`       | `mcp call calibre-librarian fetch_excerpt '{"bookId":8,"maxChars":1500}'`                             |

### Cleanup & Duplicate Workbench

| Tool                      | Example                                                                                                  |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `find_duplicates`         | `mcp call calibre-librarian find_duplicates '{"mode":"author_title","threshold":0.85}'`                  |
| `compare_books`           | `mcp call calibre-librarian compare_books '{"bookIds":[101,205],"fields":["title","series","formats"]}'` |
| `quality_report`          | `mcp call calibre-librarian quality_report '{"checks":["missing_cover","missing_tags"],"limit":20}'`     |
| `merge_duplicates` prompt | `mcp prompt calibre-librarian merge_duplicates '{"bookIds":[101,205]}'`                                  |
| `library_cleanup` prompt  | `mcp prompt calibre-librarian library_cleanup '{"focus":"missing covers"}'`                              |
| `search_library` prompt   | `mcp prompt calibre-librarian search_library '{"query":"hopepunk","searchType":"tag"}'`                  |

### Metadata Editing & Custom Columns _(requires `CALIBRE_ENABLE_WRITE_OPERATIONS=true`)_

| Tool                | Example                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `set_custom_column` | `mcp call calibre-librarian set_custom_column '{"bookId":42,"column":"#reading_status","value":"Started"}'`                  |
| `set_metadata`      | `mcp call calibre-librarian set_metadata '{"bookId":42,"title":"The Final Empire (Revised)","tags":["cosmere","favorite"]}'` |

These examples cover every MCP feature listed as complete in `@progress.txt`. Adjust IDs, names, and filters to match your own library. Prompts will guide Claude through multi-step workflows, while tools return structured responses that Claude (or you) can interpret directly.
