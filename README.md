# Calibre Librarian MCP Server

## Claude Configuration

```json
{
  "globalShortcut": "",
  "mcpServers": {
    "calibre-librarian": {
      "command": "node",
      "args": [
        "/Users/jose/Projects/personal/new-mcp-calibre/calibre-librarian-mcp/dist/stdio.js"
      ],
      "env": {
        "CALIBRE_LIBRARY_PATH": "/Users/jose/Library/CloudStorage/GoogleDrive-chepe.time@gmail.com/Mi unidad/Calibre",
        "CALIBRE_DB_COMMAND": "/opt/homebrew/bin/calibredb"
      }
    }
  },
  "preferences": {
    "quickEntryShortcut": "off",
    "menuBarEnabled": false
  }
}
```
