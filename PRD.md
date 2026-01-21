# Calibre Librarian MCP – Product Requirements Document

## 1. Vision & Goals

Create a reliable assistant that lets Claude (and other MCP clients) behave like a personal librarian: it can skim your shelves, spotlight great finds, answer “do I own this already?”, run deep searches inside books, and queue up tidy-up tasks—without ever leaving your Calibre library or uploading files elsewhere.

### Product Overview (for stakeholders)

- **What it is:** A “Calibre Librarian” capability for Claude—think of it as a concierge who knows your collection inside-out and can surface titles, clean metadata, or prep reading lists on command.
- **What it unlocks:** Conversational browsing (“show me cozy mysteries with audiobooks”), research workflows (“find quotes about stoicism”), and maintenance chores (“mark everything by Brandon Sanderson with the ‘cosmere’ tag”).
- **Where it runs:** Entirely on your machine; Claude simply talks to this MCP server to fetch answers from your library.
- **Why users care:** No more bouncing between Calibre UI and the assistant—everything happens in one conversational flow, with safeguards before any change is made.

### Feature Inventory

| #   | Feature                       | Description                                                                                                                                                                                                            |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Shelf Sampling                | Quickly list representative titles (e.g., `list_sample_books`) so Claude can grasp the collection’s flavor before diving deeper.                                                                                       |
| 2   | Calibre Query Search          | Run generic `searchBooks` queries using Calibre’s query language, mirroring the Python server’s core feature set.                                                                                                      |
| 3   | Title Wildcard Search         | Provide dedicated `search_books_by_title` with wildcard support like the Python server for fast fuzzy lookups.                                                                                                         |
| 4   | Author Discovery              | Support `search_authors_by_name`, `get_books_by_author`, and `get_books_by_author_id` flows for bibliographies.                                                                                                        |
| 5   | Series Navigator              | Offer `get_books_by_series` outputs, keeping series index ordering intact for reading order guidance.                                                                                                                  |
| 6   | Tag Explorer & Pattern Search | Implement `get_books_by_tag`, `search_books_by_tag_pattern`, and full tag listings so Claude can surface themed shelves.                                                                                               |
| 7   | Library Health Dashboard      | Provide `get_library_stats`, total counts, and tag inventories to summarize the library’s composition.                                                                                                                 |
| 8   | Book Quality Reports          | Generate per-title summaries of file size, available formats, missing covers/metadata, and Calibre quality metrics so users can triage cleanup.                                                                        |
| 9   | Full-text & Quote Finder      | Leverage Calibre FTS plus the Node server’s fallback text scans to pull contextual snippets.                                                                                                                           |
| 10  | Content Peek (Safe Fetch)     | Mirror the Node repo’s epub URL fetcher to return short excerpts or highlight locations without exporting files.                                                                                                       |
| 11  | Book Detail Sheets            | Surface rich metadata (`showDetails`, `get_book_details`) including publication info, identifiers, and formats.                                                                                                        |
| 12  | Custom Column Manager         | List and update custom columns (`getCustomColumns`, `setCustomColumn`), honoring Calibre’s write-flag requirements.                                                                                                    |
| 13  | Metadata Editor (Future)      | Adopt the Python repo’s “List/Edit Metadata” ambitions for broader field updates with guardrails.                                                                                                                      |
| 14  | Cleanup & Duplicate Workbench | Semi-automated flows that flag suspected duplicates, compare metadata fields, and guide the user through safe merges or retagging before writes occur.                                                                 |
| 15  | Resource Panels               | Expose structured resources (e.g., `calibre://library/info`, custom column feeds) for dashboards or other MCP clients.                                                                                                 |
| 16  | Missing Book Scout            | Given a user-provided reading list, attempt to match each title in Calibre; when absent, open Anna’s Archive with the query (e.g., `https://annas-archive.pm/search?q=<book+name>`) so the user can source it quickly. |
| 17  | Platform & Deployment UX      | Auto-detect `calibredb` paths (like the Windows Node server), document Claude configs, and plan HTTP/Docker options for portability.                                                                                   |
| 18  | Smart Maintenance Recipes     | Configurable “recipes” (e.g., normalize author_sort, bulk retag genres, schedule Calibre maintenance commands) that Claude can run step-by-step with user approval.                                                    |

### Success Criteria

1. **Stable connectivity** – the MCP server can start via XMCP stdio transport and respond to tool calls without crashing.
2. **Useful coverage** – metadata lookup, Calibre query search, full-text search, and basic write actions (custom columns) are exposed as MCP tools.
3. **Safe operations** – destructive actions are clearly labeled, opt-in, and respect Calibre’s access controls.
4. **Portable setup** – repo includes docs, env templates, and scripts so any Calibre user can install and run the server.

## 2. Functional Requirements

| Area                        | Requirement                                                                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Configuration               | `.env` driven paths for library directory, `calibredb`, logging verbosity, command timeouts. Validation via Zod.                                                                                                    |
| Tool registry               | XMCP auto-discovers tools under `src/tools/` & `src/prompts/`. Each tool supplies schema + metadata hints, prompt runners describe arguments.                                                                       |
| Core metadata tools         | `list_sample_books` (MVP), `listBooks`, `showDetails`, `get_library_stats`, `get_all_tags`.                                                                                                                         |
| Search & discovery          | `search_books_by_title`, `searchBooks` (Calibre query language), `search_authors_by_name`, `get_books_by_author`, `get_books_by_series`, `get_books_by_tag`, `search_books_by_tag_pattern`, `searchLibrary` prompt. |
| Full-text & content         | `fullTextSearch` (Calibre FTS), metadata-guided “fetch” equivalent for epub-style snippets, support for plain-text fallbacks similar to `calibre-mcp-nodejs`.                                                       |
| Resources API               | XMCP `resources/` tree exposes URIs such as `calibre://library/info` and `calibre://library/custom-columns` for structured consumption.                                                                             |
| Write/maintenance tools     | `getCustomColumns`, `setCustomColumn`, future `setMetadata`, duplicate detection helpers, all guarded behind env feature flags + destructive annotations.                                                           |
| Error handling & resilience | `runCalibredb` wrapper normalizes subprocess errors + timeouts, pipes diagnostics to MCP logs without breaking stdio.                                                                                               |
| Logging & observability     | Optional debug logs toggleable via env (respect STDIO limitations), structured stderr for Claude debugging.                                                                                                         |
| Packaging & transport       | XMCP stdio dev server + `dist/stdio.js` bundle, plan for HTTP transport (mirroring Python server) and Docker recipe.                                                                                                |

### Feature Backlog (sourced from reference MCP servers)

1. **Advanced metadata search** – port Python server tools for title/author/tag/series wildcards so Claude can drill down by any facet.
2. **Author/series explorers** – expose `get_books_by_author_id`, `get_books_by_series`, and “author discovery” style prompts for bibliographies.
3. **Tag management** – surface all tags + pattern search to help reclassify library entries.
4. **Library stats dashboard** – mirror `get_library_stats` so Claude can summarize counts by format, tag, author, etc.
5. **Content retrieval** – add a safe `fetch_excerpt` tool modeled after the Node server’s epub URL reader (short snippets only, honoring Calibre permissions).
6. **Full-text combo search** – combine metadata filters with FTS results (metadata search fallback is already sketched in the Node version).
7. **Write helpers** – stage tasks for batch custom-column updates, metadata hygiene (“library cleanup”) prompt flows with confirmations.
8. **Transport/runtime options** – optional HTTP transport for remote XMCP hosting plus Dockerfile for repeatable deployments.

## 3. Non-Functional Requirements

- **Performance:** tool calls should complete within 15 seconds or return timeouts with suggestions.
- **Security:** assumes local trusted environment; no remote auth. Document prerequisites (Calibre server write flag) before enabling writes.
- **Compatibility:** Node 20+, macOS/Linux paths, works offline.

### Technical Stack (reference appendix)

- **Runtime:** Node 20+, XMCP stdio transport for Claude/Desktop clients.
- **Language:** TypeScript with Zod validation and shared Calibre utility abstractions.
- **CLI & builds:** pnpm + XMCP dev/build, `dist/stdio.js` bundle for Claude.
- **Integration points:** `calibredb` CLI for metadata + FTS, future HTTP transport parity with Python server, resources exposed via XMCP file-based routing.

## 4. MVP Scope

1. XMCP stdio transport configured via `xmcp.config.ts`.
2. Environment validation + calibredb runner.
3. Minimal tool set: list sample books, show metadata for book ID.
4. README/CLAUDE.md/PRD describing intended behavior and setup.

## 5. Roadmap

1. **Phase 1 (MVP):** complete above items, verify with MCP Inspector.
2. **Phase 2:** add search + FTS tools, improve responses (structured JSON + friendly summaries).
3. **Phase 3:** implement write tools, opt-in safety checks, and automated tests.
4. **Phase 4:** packaging (Docker, XMCP deployment, release instructions).
5. **Phase 5:** codebase improvements for maintainability and testability.

### Phase 5: Codebase Improvements

Refactoring opportunities identified to reduce duplication, improve testability, and make adding new features easier.

#### Utility Extractions

| Improvement | Description | Files Affected | Priority |
|-------------|-------------|----------------|----------|
| Query helpers | `buildFieldQuery()`, `buildListArgs()` for consistent Calibre query building | 4+ tools | High |
| Book fetching utils | `getBookById<T>()`, `getBooksByIds<T>()` for common book retrieval patterns | 4+ tools | High |
| ebook-convert wrapper | Extract `convertToText()` to `src/utils/ebook-convert.ts` | 2 tools | Medium |
| Empty result handling | `formatNoResults()` for consistent "no results" messages | 10+ tools | Medium |
| Shared schema constants | Centralized `LIMITS`, `commonSchemas` for pagination/sorting | All tools | Medium |
| Category parsing | `parseCategories()`, `parseAuthorsFromCategories()`, `parseTagsFromCategories()` | 3 tools | Medium |

#### Testing Infrastructure

| Improvement | Description | Priority |
|-------------|-------------|----------|
| Mock calibredb | `mockCalibredbOutput()`, `mockCalibredbError()` for isolated tool testing | High |
| Test fixtures | Sample books, authors, tags data for consistent test scenarios | High |
| Integration tests | End-to-end tests with mocked calibredb responses | Medium |

#### Code Quality

| Improvement | Description | Priority |
|-------------|-------------|----------|
| Enforce kebab-case | All source files use kebab-case naming | Done |
| Type-safe JSON parsing | Replace unsafe casts with validated parsers | Medium |
| Consistent error handling | Standardized error formatting across all tools | Medium |

## 6. Open Questions

1. Do we need multilingual support for metadata/FTS results?
2. Should we cache Calibre responses for repeated queries?
3. What telemetry or logging is acceptable when running locally (or via XMCP cloud)?
4. How should we handle extremely large libraries (pagination strategies)?
