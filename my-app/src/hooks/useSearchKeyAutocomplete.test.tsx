import React from "react";
import { createEvent, fireEvent, render, screen } from "@testing-library/react";
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

  it("supports next key autocomplete both with and without a space after semicolon", () => {
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "search" }) as HTMLInputElement;

    input.focus();
    fireEvent.focus(input);

    const withSpace = "language:english; wa";
    fireEvent.change(input, {
      target: {
        value: withSpace,
        selectionStart: withSpace.length,
        selectionEnd: withSpace.length,
      },
    });
    expect(input.value).toBe("language:english; ward");

    const withoutSpace = "language:english;wa";
    fireEvent.change(input, {
      target: {
        value: withoutSpace,
        selectionStart: withoutSpace.length,
        selectionEnd: withoutSpace.length,
      },
    });
    expect(input.value).toBe("language:english;ward");
  });

  it("autocompletes next key in compact multi-filter form without space after semicolon", () => {
    const DeliveryHarness = () => {
      const [value, setValue] = React.useState("");
      const autocomplete = useSearchKeyAutocomplete({
        value,
        onValueChange: setValue,
        suggestions: ["name", "delivery instructions", "delivery frequency", "gender"],
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

    render(<DeliveryHarness />);
    const input = screen.getByRole("textbox", { name: "search" }) as HTMLInputElement;

    input.focus();
    fireEvent.focus(input);

    const compactQuery = "name:jamie;deliveryfr";
    fireEvent.change(input, {
      target: {
        value: compactQuery,
        selectionStart: compactQuery.length,
        selectionEnd: compactQuery.length,
      },
    });

    expect(input.value).toBe("name:jamie;delivery frequency");
  });

  it("commits selected inline key with Tab in compact multi-filter input", () => {
    const DeliveryHarness = () => {
      const [value, setValue] = React.useState("");
      const autocomplete = useSearchKeyAutocomplete({
        value,
        onValueChange: setValue,
        suggestions: ["name", "delivery instructions", "delivery frequency", "gender"],
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

    render(<DeliveryHarness />);
    const input = screen.getByRole("textbox", { name: "search" }) as HTMLInputElement;

    input.focus();
    fireEvent.focus(input);

    const compactQuery = "name:jamie;deliveryfr";
    fireEvent.change(input, {
      target: {
        value: compactQuery,
        selectionStart: compactQuery.length,
        selectionEnd: compactQuery.length,
      },
    });

    expect(input.value).toBe("name:jamie;delivery frequency");

    fireEvent.keyDown(input, { key: "Tab" });

    expect(input.value).toBe("name:jamie;delivery frequency:");
    expect(input.selectionStart).toBe("name:jamie;delivery frequency:".length);
    expect(input.selectionEnd).toBe("name:jamie;delivery frequency:".length);
  });

  it("commits selected inline key with Enter in compact multi-filter input", () => {
    const DeliveryHarness = () => {
      const [value, setValue] = React.useState("");
      const autocomplete = useSearchKeyAutocomplete({
        value,
        onValueChange: setValue,
        suggestions: ["name", "delivery instructions", "delivery frequency", "gender"],
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

    render(<DeliveryHarness />);
    const input = screen.getByRole("textbox", { name: "search" }) as HTMLInputElement;

    input.focus();
    fireEvent.focus(input);

    const compactQuery = "name:jamie;deliveryfr";
    fireEvent.change(input, {
      target: {
        value: compactQuery,
        selectionStart: compactQuery.length,
        selectionEnd: compactQuery.length,
      },
    });

    expect(input.value).toBe("name:jamie;delivery frequency");

    fireEvent.keyDown(input, { key: "Enter" });

    expect(input.value).toBe("name:jamie;delivery frequency:");
    expect(input.selectionStart).toBe("name:jamie;delivery frequency:".length);
    expect(input.selectionEnd).toBe("name:jamie;delivery frequency:".length);
  });

  it("prefers the strongest key match when typing deliveryfr", () => {
    const DeliveryHarness = () => {
      const [value, setValue] = React.useState("");
      const autocomplete = useSearchKeyAutocomplete({
        value,
        onValueChange: setValue,
        suggestions: ["delivery instructions", "delivery frequency", "name"],
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

    render(<DeliveryHarness />);
    const input = screen.getByRole("textbox", { name: "search" }) as HTMLInputElement;

    input.focus();
    fireEvent.focus(input);
    fireEvent.change(input, {
      target: { value: "deliveryfr", selectionStart: 10, selectionEnd: 10 },
    });

    expect(input.value).toBe("delivery frequency");
  });

  it("does not force autocomplete when a prefix matches multiple keys", () => {
    const DeliveryHarness = () => {
      const [value, setValue] = React.useState("");
      const autocomplete = useSearchKeyAutocomplete({
        value,
        onValueChange: setValue,
        suggestions: ["delivery instructions", "delivery frequency", "name"],
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

    render(<DeliveryHarness />);
    const input = screen.getByRole("textbox", { name: "search" }) as HTMLInputElement;

    input.focus();
    fireEvent.focus(input);
    fireEvent.change(input, {
      target: { value: "delivery", selectionStart: 8, selectionEnd: 8 },
    });

    expect(input.value).toBe("delivery");
  });

  it("keeps focus in input on Tab when editing an ambiguous key prefix", () => {
    const DeliveryHarness = () => {
      const [value, setValue] = React.useState("");
      const autocomplete = useSearchKeyAutocomplete({
        value,
        onValueChange: setValue,
        suggestions: ["delivery instructions", "delivery frequency", "name"],
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

    render(<DeliveryHarness />);
    const input = screen.getByRole("textbox", { name: "search" }) as HTMLInputElement;

    input.focus();
    fireEvent.focus(input);
    fireEvent.change(input, {
      target: { value: "delivery", selectionStart: 8, selectionEnd: 8 },
    });

    const tabEvent = createEvent.keyDown(input, { key: "Tab" });
    fireEvent(input, tabEvent);

    expect(tabEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe("delivery");
  });

  it("prevents Tab from leaving input when query does not end with semicolon", () => {
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "search" }) as HTMLInputElement;

    input.focus();
    fireEvent.focus(input);
    fireEvent.change(input, {
      target: { value: "name:jamie", selectionStart: 10, selectionEnd: 10 },
    });

    const tabEvent = createEvent.keyDown(input, { key: "Tab" });
    fireEvent(input, tabEvent);

    expect(tabEvent.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input);
  });

  it("allows Tab to move focus when query ends with semicolon", () => {
    render(<Harness />);
    const input = screen.getByRole("textbox", { name: "search" }) as HTMLInputElement;

    input.focus();
    fireEvent.focus(input);
    fireEvent.change(input, {
      target: { value: "name:jamie;", selectionStart: 11, selectionEnd: 11 },
    });

    const tabEvent = createEvent.keyDown(input, { key: "Tab" });
    fireEvent(input, tabEvent);

    expect(tabEvent.defaultPrevented).toBe(false);
  });
});
