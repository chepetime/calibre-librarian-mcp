import { describe, it, expect } from "vitest";
import {
  buildFieldQuery,
  buildListArgs,
  buildIdQuery,
  combineQueries,
  FIELD_PRESETS,
} from "./query";

describe("buildFieldQuery", () => {
  it("builds contains query by default", () => {
    expect(buildFieldQuery("title", "lord of the rings")).toBe(
      'title:"~lord of the rings"'
    );
  });

  it("builds contains query when exact is false", () => {
    expect(buildFieldQuery("author", "Tolkien", false)).toBe(
      'author:"~Tolkien"'
    );
  });

  it("builds exact match query when exact is true", () => {
    expect(buildFieldQuery("title", "The Hobbit", true)).toBe(
      'title:"=The Hobbit"'
    );
  });

  it("works with tag field", () => {
    expect(buildFieldQuery("tag", "fantasy", false)).toBe('tag:"~fantasy"');
    expect(buildFieldQuery("tag", "Science Fiction", true)).toBe(
      'tag:"=Science Fiction"'
    );
  });

  it("works with series field", () => {
    expect(buildFieldQuery("series", "Stormlight", false)).toBe(
      'series:"~Stormlight"'
    );
  });

  it("works with custom field names", () => {
    expect(buildFieldQuery("custom_field", "value", false)).toBe(
      'custom_field:"~value"'
    );
  });
});

describe("buildListArgs", () => {
  it("builds basic list args with string fields", () => {
    const args = buildListArgs({ fields: "id,title,authors" });
    expect(args).toEqual(["list", "--fields", "id,title,authors"]);
  });

  it("builds list args with array fields", () => {
    const args = buildListArgs({ fields: ["id", "title", "authors"] });
    expect(args).toEqual(["list", "--fields", "id,title,authors"]);
  });

  it("resolves BASIC field preset", () => {
    const args = buildListArgs({ fields: "BASIC" });
    expect(args).toEqual(["list", "--fields", FIELD_PRESETS.BASIC]);
  });

  it("resolves EXTENDED field preset", () => {
    const args = buildListArgs({ fields: "EXTENDED" });
    expect(args).toEqual(["list", "--fields", FIELD_PRESETS.EXTENDED]);
  });

  it("resolves FULL field preset", () => {
    const args = buildListArgs({ fields: "FULL" });
    expect(args).toEqual(["list", "--fields", FIELD_PRESETS.FULL]);
  });

  it("adds search parameter", () => {
    const args = buildListArgs({
      fields: "BASIC",
      search: 'author:"~Tolkien"',
    });
    expect(args).toContain("--search");
    expect(args).toContain('author:"~Tolkien"');
  });

  it("adds sortBy parameter", () => {
    const args = buildListArgs({
      fields: "BASIC",
      sortBy: "title",
    });
    expect(args).toContain("--sort-by");
    expect(args).toContain("title");
  });

  it("adds ascending flag when true", () => {
    const args = buildListArgs({
      fields: "BASIC",
      sortBy: "title",
      ascending: true,
    });
    expect(args).toContain("--ascending");
  });

  it("does not add ascending flag when false", () => {
    const args = buildListArgs({
      fields: "BASIC",
      sortBy: "title",
      ascending: false,
    });
    expect(args).not.toContain("--ascending");
  });

  it("does not add ascending flag when undefined", () => {
    const args = buildListArgs({
      fields: "BASIC",
      sortBy: "title",
    });
    expect(args).not.toContain("--ascending");
  });

  it("adds limit parameter", () => {
    const args = buildListArgs({
      fields: "BASIC",
      limit: 25,
    });
    expect(args).toContain("--limit");
    expect(args).toContain("25");
  });

  it("adds forMachine flag", () => {
    const args = buildListArgs({
      fields: "BASIC",
      forMachine: true,
    });
    expect(args).toContain("--for-machine");
  });

  it("builds complete args with all options", () => {
    const args = buildListArgs({
      fields: "BASIC",
      search: 'title:"~rings"',
      sortBy: "title",
      ascending: true,
      limit: 50,
    });
    expect(args).toEqual([
      "list",
      "--fields",
      FIELD_PRESETS.BASIC,
      "--search",
      'title:"~rings"',
      "--sort-by",
      "title",
      "--ascending",
      "--limit",
      "50",
    ]);
  });

  it("builds forMachine args", () => {
    const args = buildListArgs({
      fields: "DUPLICATES",
      forMachine: true,
    });
    expect(args).toEqual([
      "list",
      "--fields",
      FIELD_PRESETS.DUPLICATES,
      "--for-machine",
    ]);
  });

  it("builds forMachine args with search", () => {
    const args = buildListArgs({
      fields: ["id", "title"],
      search: "id:123",
      forMachine: true,
    });
    expect(args).toEqual([
      "list",
      "--fields",
      "id,title",
      "--search",
      "id:123",
      "--for-machine",
    ]);
  });
});

describe("buildIdQuery", () => {
  it("builds query for single ID", () => {
    expect(buildIdQuery(123)).toBe("id:123");
  });

  it("builds query for multiple IDs", () => {
    expect(buildIdQuery([1, 2, 3])).toBe("id:1 or id:2 or id:3");
  });

  it("handles single-element array", () => {
    expect(buildIdQuery([42])).toBe("id:42");
  });

  it("handles empty array", () => {
    expect(buildIdQuery([])).toBe("");
  });
});

describe("combineQueries", () => {
  it("combines two queries with AND", () => {
    expect(combineQueries(['author:"~Tolkien"', "tag:fantasy"])).toBe(
      'author:"~Tolkien" and tag:fantasy'
    );
  });

  it("combines multiple queries with AND", () => {
    expect(
      combineQueries(['author:"~Sanderson"', "tag:fantasy", "series:cosmere"])
    ).toBe('author:"~Sanderson" and tag:fantasy and series:cosmere');
  });

  it("handles single query", () => {
    expect(combineQueries(['title:"~hobbit"'])).toBe('title:"~hobbit"');
  });

  it("filters out empty strings", () => {
    expect(combineQueries(["", 'author:"~Tolkien"', "", "tag:fantasy"])).toBe(
      'author:"~Tolkien" and tag:fantasy'
    );
  });

  it("handles empty array", () => {
    expect(combineQueries([])).toBe("");
  });
});

describe("FIELD_PRESETS", () => {
  it("has BASIC preset with expected fields", () => {
    expect(FIELD_PRESETS.BASIC).toBe("id,title,authors,tags,series,formats");
  });

  it("has EXTENDED preset with series_index", () => {
    expect(FIELD_PRESETS.EXTENDED).toContain("series_index");
    expect(FIELD_PRESETS.EXTENDED).toContain("pubdate");
  });

  it("has FULL preset with all common fields", () => {
    expect(FIELD_PRESETS.FULL).toContain("publisher");
    expect(FIELD_PRESETS.FULL).toContain("rating");
    expect(FIELD_PRESETS.FULL).toContain("identifiers");
    expect(FIELD_PRESETS.FULL).toContain("languages");
    expect(FIELD_PRESETS.FULL).toContain("comments");
  });

  it("has DUPLICATES preset for duplicate detection", () => {
    expect(FIELD_PRESETS.DUPLICATES).toBe(
      "id,title,authors,identifiers,formats"
    );
  });

  it("has QUALITY preset for quality reports", () => {
    expect(FIELD_PRESETS.QUALITY).toContain("cover");
    expect(FIELD_PRESETS.QUALITY).toContain("comments");
    expect(FIELD_PRESETS.QUALITY).toContain("rating");
  });
});
