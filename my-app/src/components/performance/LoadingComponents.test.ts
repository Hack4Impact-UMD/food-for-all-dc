import { describe, expect, it, jest } from "@jest/globals";
import { isChunkLoadError, shouldReloadForChunkError } from "./LoadingComponents";

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: jest.fn((key: string) => values.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => values.set(key, value)),
  };
};

describe("chunk load recovery", () => {
  it("recognizes lazy chunk failures", () => {
    expect(
      isChunkLoadError(
        new Error(
          "Loading chunk 196 failed. (error: https://example.web.app/static/js/196.hash.chunk.js)"
        )
      )
    ).toBe(true);
    expect(isChunkLoadError(new Error("Failed to fetch dynamically imported module"))).toBe(true);
    expect(isChunkLoadError(new Error("Permission denied"))).toBe(false);
  });

  it("allows one automatic reload per failed chunk message", () => {
    const storage = createStorage();
    const error = new Error("Loading chunk 196 failed.");

    expect(shouldReloadForChunkError(error, storage)).toBe(true);
    expect(shouldReloadForChunkError(error, storage)).toBe(false);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });
});
