import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { useSearchKeyAutocomplete } from "./useSearchKeyAutocomplete";

const suggestions = ["cluster id", "ward", "name"];

const Harness = () => {
  const [value, setValue] = React.useState("");
  const autocomplete = useSearchKeyAutocomplete({
    value,
    onValueChange: setValue,
    suggestions,
  });

  return (
    <input
      aria-label="search"
      ref={autocomplete.inputRef}
      value={value}
      onChange={autocomplete.handleInputChange}
      onFocus={autocomplete.handleInputFocus}
      onClick={autocomplete.handleInputClick}
      onBlur={autocomplete.handleInputBlur}
      onKeyDown={autocomplete.handleInputKeyDown}
      onKeyUp={autocomplete.handleInputKeyUp}
    />
  );
};

describe("useSearchKeyAutocomplete", () => {
  beforeEach(() => {
    jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback): number => {
        callback(0);
        return 0;
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("commits inline completion with Tab and appends colon without duplicating suffix", () => {
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "search" }) as HTMLInputElement;

    input.focus();
    fireEvent.focus(input);
    fireEvent.change(input, {
      target: { value: "clu", selectionStart: 3, selectionEnd: 3 },
    });

    expect(input.value).toBe("cluster id");

    fireEvent.keyDown(input, { key: "Tab" });

    expect(input.value).toBe("cluster id:");
    expect(input.selectionStart).toBe("cluster id:".length);
    expect(input.selectionEnd).toBe("cluster id:".length);
  });

  it("commits inline completion with Enter and appends colon", () => {
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "search" }) as HTMLInputElement;

    input.focus();
    fireEvent.focus(input);
    fireEvent.change(input, {
      target: { value: "clu", selectionStart: 3, selectionEnd: 3 },
    });

    expect(input.value).toBe("cluster id");

    fireEvent.keyDown(input, { key: "Enter" });

    expect(input.value).toBe("cluster id:");
    expect(input.selectionStart).toBe("cluster id:".length);
    expect(input.selectionEnd).toBe("cluster id:".length);
  });

  it("lets users backspace without being forced back into autosuggest", () => {
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "search" }) as HTMLInputElement;

    input.focus();
    fireEvent.focus(input);
    fireEvent.change(input, {
      target: { value: "clu", selectionStart: 3, selectionEnd: 3 },
    });

    expect(input.value).toBe("cluster id");

    fireEvent.keyDown(input, { key: "Backspace" });
    fireEvent.change(input, {
      target: { value: "clu", selectionStart: 3, selectionEnd: 3 },
    });

    expect(input.value).toBe("clu");
    expect(input.value).not.toBe("cluster id");
  });

  it("does not start next key autocomplete after a value until a semicolon is typed", () => {
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "search" }) as HTMLInputElement;

    input.focus();
    fireEvent.focus(input);

    const withoutSemicolon = "language:english wa";
    fireEvent.change(input, {
      target: {
        value: withoutSemicolon,
        selectionStart: withoutSemicolon.length,
        selectionEnd: withoutSemicolon.length,
      },
    });

    expect(input.value).toBe(withoutSemicolon);

    const withSemicolon = "language:english; wa";
    fireEvent.change(input, {
      target: {
        value: withSemicolon,
        selectionStart: withSemicolon.length,
        selectionEnd: withSemicolon.length,
      },
    });

    expect(input.value).toBe("language:english; ward");
  });
});
