import { config } from "../config";

export const metadata = {
  name: "calibre://docs/inspector-guide",
  description:
    "Guide for testing the Calibre Librarian MCP server using MCP Inspector",
  mimeType: "text/markdown",
};

export default async function inspectorGuide() {
  const guide = `# MCP Inspector Verification Guide

This guide helps you verify your Calibre Librarian MCP server is working correctly
using the MCP Inspector tool.

## Prerequisites

1. **Node.js 20+** installed
2. **Calibre** installed with \`calibredb\` accessible
3. **CALIBRE_LIBRARY_PATH** environment variable set

Current configuration:
- Library path: \`${config.calibreLibraryPath}\`
- calibredb command: \`${config.calibredbCommand}\`
- Write operations: ${config.enableWriteOperations ? "enabled" : "disabled"}

## Installing MCP Inspector

\`\`\`bash
npx @anthropic/mcp-inspector
\`\`\`

Or install globally:

\`\`\`bash
npm install -g @anthropic/mcp-inspector
mcp-inspector
\`\`\`

## Running the Server for Inspection

### Option 1: Development Mode

\`\`\`bash
# In the project directory
npm run dev
\`\`\`

Then connect MCP Inspector to the dev server.

### Option 2: Built Server

\`\`\`bash
# Build first
npm run build

# Run the inspector pointing to the built server
npx @anthropic/mcp-inspector node dist/stdio.js
\`\`\`

## Verification Steps

### Step 1: Check Server Connection

1. Open MCP Inspector
2. Verify the server appears as connected
3. Check that no startup errors are shown

### Step 2: List Available Tools

In the Inspector, you should see these tools:

**Core Tools:**
- \`list_sample_books\` - List representative books
- \`get_book_details\` - Show metadata for a book
- \`search_books\` - Calibre query search

**Discovery Tools:**
- \`search_books_by_title\` - Title wildcard search
- \`get_library_stats\` - Library statistics
- \`get_all_tags\` - List all tags
- \`search_authors_by_name\` - Find authors
- \`get_books_by_author\` - Books by author name
- \`get_books_by_series\` - Books in a series
- \`get_books_by_tag\` - Books with tag

**Content Tools:**
- \`full_text_search\` - Search inside books
- \`fetch_excerpt\` - Preview book content
- \`search_book_content\` - Search within a book

**Maintenance Tools:**
- \`find_duplicates\` - Detect duplicates
- \`compare_books\` - Side-by-side comparison
- \`quality_report\` - Library health check
- \`normalize_author_sort\` - Fix author_sort
- \`bulk_retag\` - Mass tag operations
- \`library_maintenance\` - Run maintenance ops
- \`missing_book_scout\` - Check reading lists

**Write Tools (if enabled):**
- \`set_metadata\` - Update book metadata
- \`set_custom_column\` - Update custom columns
- \`get_custom_columns\` - List custom columns

### Step 3: Test Core Functionality

Run these tool calls to verify basic operation:

#### Test 1: List Sample Books
\`\`\`json
{
  "tool": "list_sample_books",
  "arguments": { "count": 5 }
}
\`\`\`
**Expected:** Returns 5 books from your library

#### Test 2: Get Library Stats
\`\`\`json
{
  "tool": "get_library_stats",
  "arguments": {}
}
\`\`\`
**Expected:** Returns book counts, formats, top authors/tags

#### Test 3: Search Books
\`\`\`json
{
  "tool": "search_books",
  "arguments": { "query": "tag:fiction", "limit": 5 }
}
\`\`\`
**Expected:** Returns fiction books (or appropriate message if none)

#### Test 4: Get Book Details
\`\`\`json
{
  "tool": "get_book_details",
  "arguments": { "bookId": 1 }
}
\`\`\`
**Expected:** Returns full metadata for book ID 1

### Step 4: Check Resources

Verify these resources are available:
- \`calibre://library/info\` - Library information
- \`calibre://library/custom-columns\` - Custom column definitions
- \`calibre://docs/inspector-guide\` - This guide

### Step 5: Check Prompts

Verify these prompts are available:
- \`search_library\` - Guided library search
- \`library_cleanup\` - Library hygiene helper
- \`merge_duplicates\` - Duplicate handling workflow

## Troubleshooting

### "calibredb not found"
- Check \`CALIBRE_DB_COMMAND\` environment variable
- Verify Calibre is installed
- On macOS: try \`/Applications/calibre.app/Contents/MacOS/calibredb\`
- On Windows: try \`C:\\Program Files\\Calibre2\\calibredb.exe\`

### "Library not found"
- Verify \`CALIBRE_LIBRARY_PATH\` points to a directory with \`metadata.db\`
- Check the path exists and is readable

### "Permission denied"
- Ensure the user running the server has read access to the library
- For write operations, ensure write access too

### "Timeout errors"
- Large libraries may need increased timeout
- Set \`CALIBRE_COMMAND_TIMEOUT_MS\` (default: 15000ms)

### "Write operations disabled"
- Set \`CALIBRE_ENABLE_WRITE_OPERATIONS=true\` in environment
- Restart the server after changing

## Success Criteria

Your server is working correctly if:

1. ✓ Server connects without errors
2. ✓ All tools are listed
3. ✓ \`list_sample_books\` returns books from your library
4. ✓ \`search_books\` finds books matching queries
5. ✓ \`get_book_details\` shows full metadata
6. ✓ Resources return library information

## Next Steps

Once verified, you can:
1. Configure Claude Desktop using \`generate_claude_config\`
2. Start using the tools in conversations
3. Enable write operations if needed
`;

  return {
    contents: [
      {
        uri: metadata.name,
        mimeType: metadata.mimeType,
        text: guide,
      },
    ],
  };
}
