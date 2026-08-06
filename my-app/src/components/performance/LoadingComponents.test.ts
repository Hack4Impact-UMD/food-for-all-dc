import React from "react";
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { ErrorBoundary, isChunkLoadError, shouldReloadForChunkError } from "./LoadingComponents";

const createStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: jest.fn((key: string) => values.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => values.set(key, value)),
  };
};

describe("chunk load recovery", () => {
  afterEach(() => {
    jest.useRealTimers();
    window.sessionStorage.clear();
    jest.restoreAllMocks();
  });

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

  it("expires the retry marker after a repeated chunk failure", () => {
    jest.useFakeTimers();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const message = "Loading chunk 196 failed.";
    window.sessionStorage.setItem("ffaChunkReloadError", message);

    const ThrowChunkError = () => {
      throw new Error(message);
    };

    render(React.createElement(ErrorBoundary, null, React.createElement(ThrowChunkError)));

    expect(window.sessionStorage.getItem("ffaChunkReloadError")).toBe(message);

    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(window.sessionStorage.getItem("ffaChunkReloadError")).toBeNull();
  });
});
