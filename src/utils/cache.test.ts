import { describe, it, expect, beforeEach, vi } from "vitest";
import { calibreCache, makeCacheKey, invalidateCache } from "./cache";

describe("Cache", () => {
  beforeEach(() => {
    invalidateCache();
  });

  describe("get/set", () => {
    it("should store and retrieve values", () => {
      calibreCache.set("test-key", "test-value");
      expect(calibreCache.get("test-key")).toBe("test-value");
    });

    it("should return undefined for missing keys", () => {
      expect(calibreCache.get("nonexistent")).toBeUndefined();
    });

    it("should store objects", () => {
      const obj = { foo: "bar", count: 42 };
      calibreCache.set("object-key", obj);
      expect(calibreCache.get("object-key")).toEqual(obj);
    });

    it("should store arrays", () => {
      const arr = [1, 2, 3];
      calibreCache.set("array-key", arr);
      expect(calibreCache.get("array-key")).toEqual(arr);
    });
  });

  describe("TTL expiration", () => {
    it("should expire entries after TTL", () => {
      vi.useFakeTimers();

      calibreCache.set("expires", "value", 1000); // 1 second TTL
      expect(calibreCache.get("expires")).toBe("value");

      vi.advanceTimersByTime(500);
      expect(calibreCache.get("expires")).toBe("value");

      vi.advanceTimersByTime(600); // Now past 1000ms
      expect(calibreCache.get("expires")).toBeUndefined();

      vi.useRealTimers();
    });

    it("should use custom TTL when provided", () => {
      vi.useFakeTimers();

      calibreCache.set("short", "value", 100);
      calibreCache.set("long", "value", 5000);

      vi.advanceTimersByTime(200);

      expect(calibreCache.get("short")).toBeUndefined();
      expect(calibreCache.get("long")).toBe("value");

      vi.useRealTimers();
    });
  });

  describe("has", () => {
    it("should return true for existing non-expired keys", () => {
      calibreCache.set("exists", "value");
      expect(calibreCache.has("exists")).toBe(true);
    });

    it("should return false for missing keys", () => {
      expect(calibreCache.has("missing")).toBe(false);
    });

    it("should return false for expired keys", () => {
      vi.useFakeTimers();

      calibreCache.set("expires", "value", 100);
      vi.advanceTimersByTime(200);

      expect(calibreCache.has("expires")).toBe(false);

      vi.useRealTimers();
    });
  });

  describe("delete", () => {
    it("should remove a key from the cache", () => {
      calibreCache.set("to-delete", "value");
      expect(calibreCache.get("to-delete")).toBe("value");

      calibreCache.delete("to-delete");
      expect(calibreCache.get("to-delete")).toBeUndefined();
    });

    it("should return true when key existed", () => {
      calibreCache.set("exists", "value");
      expect(calibreCache.delete("exists")).toBe(true);
    });

    it("should return false when key did not exist", () => {
      expect(calibreCache.delete("nonexistent")).toBe(false);
    });
  });

  describe("clear / invalidateCache", () => {
    it("should remove all entries", () => {
      calibreCache.set("key1", "value1");
      calibreCache.set("key2", "value2");
      calibreCache.set("key3", "value3");

      invalidateCache();

      expect(calibreCache.get("key1")).toBeUndefined();
      expect(calibreCache.get("key2")).toBeUndefined();
      expect(calibreCache.get("key3")).toBeUndefined();
    });
  });

  describe("prune", () => {
    it("should remove expired entries", () => {
      vi.useFakeTimers();

      calibreCache.set("expired1", "value", 100);
      calibreCache.set("expired2", "value", 100);
      calibreCache.set("valid", "value", 5000);

      vi.advanceTimersByTime(200);

      const pruned = calibreCache.prune();
      expect(pruned).toBe(2);
      expect(calibreCache.get("valid")).toBe("value");

      vi.useRealTimers();
    });
  });

  describe("stats", () => {
    it("should return cache size and keys", () => {
      calibreCache.set("key1", "value1");
      calibreCache.set("key2", "value2");

      const stats = calibreCache.stats();
      expect(stats.size).toBe(2);
      expect(stats.keys).toContain("key1");
      expect(stats.keys).toContain("key2");
    });

    it("should not include expired entries in stats", () => {
      vi.useFakeTimers();

      calibreCache.set("expired", "value", 100);
      calibreCache.set("valid", "value", 5000);

      vi.advanceTimersByTime(200);

      const stats = calibreCache.stats();
      expect(stats.size).toBe(1);
      expect(stats.keys).toContain("valid");
      expect(stats.keys).not.toContain("expired");

      vi.useRealTimers();
    });
  });
});

describe("makeCacheKey", () => {
  it("should create consistent keys from args", () => {
    const key1 = makeCacheKey(["list", "--fields", "id,title"]);
    const key2 = makeCacheKey(["list", "--fields", "id,title"]);
    expect(key1).toBe(key2);
  });

  it("should create different keys for different args", () => {
    const key1 = makeCacheKey(["list", "--fields", "id"]);
    const key2 = makeCacheKey(["list", "--fields", "title"]);
    expect(key1).not.toBe(key2);
  });

  it("should include calibredb prefix", () => {
    const key = makeCacheKey(["list"]);
    expect(key).toBe("calibredb:list");
  });

  it("should join args with colons", () => {
    const key = makeCacheKey(["list", "--for-machine"]);
    expect(key).toBe("calibredb:list:--for-machine");
  });
});
