import { useCallback, useMemo, useRef, useState } from "react";
import { normalizeSearchKeyword } from "../utils/searchFilter";

interface SegmentInfo {
  keyStart: number;
  keyEnd: number;
  typedKeyRaw: string;
  hasColon: boolean;
}

const getSegmentInfo = (
  value: string,
  cursorPosition: number,
  normalizedSuggestions: Array<{ raw: string; normalized: string }>
): SegmentInfo | null => {
  const safeCursor = Math.max(0, Math.min(cursorPosition, value.length));
  const baseStart = value.lastIndexOf(";", Math.max(0, safeCursor - 1)) + 1;
  const preCursorSegment = value.slice(baseStart, safeCursor);
  const firstColonInSegment = preCursorSegment.indexOf(":");

  // Autocomplete keys only while the user is in the key part (before ':')
  // of the current semicolon-delimited segment.
  if (firstColonInSegment !== -1) {
    return null;
  }

  const findMatchingKeyStart = (text: string): number | null => {
    let bestMatchStart: number | null = null;
    let bestMatchLength = -1;

    for (let start = 0; start < text.length; start += 1) {
      const candidateRaw = text.slice(start);
      if (candidateRaw.includes(":")) {
        continue;
      }

      const leadingWhitespace = (candidateRaw.match(/^\s*/) ?? [""])[0];
      const keyCandidate = candidateRaw.slice(leadingWhitespace.length);
      if (!keyCandidate.trim()) {
        continue;
      }

      const normalizedCandidate = normalizeSearchKeyword(keyCandidate);
      if (!normalizedCandidate) {
        continue;
      }

      const hasPrefixMatch = normalizedSuggestions.some((suggestion) =>
        suggestion.normalized.startsWith(normalizedCandidate)
      );

      if (hasPrefixMatch && normalizedCandidate.length > bestMatchLength) {
        bestMatchStart = start + leadingWhitespace.length;
        bestMatchLength = normalizedCandidate.length;
      }
    }

    return bestMatchStart;
  };

  const activeOffsetWithinSegment = findMatchingKeyStart(preCursorSegment);

  if (activeOffsetWithinSegment === null) {
    return null;
  }

  const keyStart = baseStart + activeOffsetWithinSegment;

  const nextSemicolonFromKey = value.indexOf(";", keyStart);
  const endBoundary = nextSemicolonFromKey === -1 ? value.length : nextSemicolonFromKey;
  const colonAfterKey = value.indexOf(":", keyStart);
  const hasColon = colonAfterKey !== -1 && colonAfterKey < endBoundary;

  if (hasColon && safeCursor > colonAfterKey) {
    return null;
  }

  const keyEnd = hasColon ? colonAfterKey : safeCursor;
  const typedKeyRaw = value.slice(keyStart, safeCursor);

  return {
    keyStart,
    keyEnd,
    typedKeyRaw,
    hasColon,
  };
};

interface UseSearchKeyAutocompleteParams {
  value: string;
  onValueChange: (value: string) => void;
  suggestions: string[];
}

export const useSearchKeyAutocomplete = ({
  value,
  onValueChange,
  suggestions,
}: UseSearchKeyAutocompleteParams) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const suppressInlineAutocompleteRef = useRef(false);
  const [cursorPosition, setCursorPosition] = useState(0);

  const normalizedSuggestions = useMemo(
    () =>
      Array.from(new Set(suggestions)).map((suggestion) => ({
        raw: suggestion,
        normalized: normalizeSearchKeyword(suggestion),
      })),
    [suggestions]
  );

  const updateCursorPosition = useCallback((target: HTMLInputElement) => {
    setCursorPosition(target.selectionStart ?? target.value.length);
  }, []);

  const getBestSuggestionFor = useCallback(
    (typedKeyRaw: string): string | null => {
      const normalizedKey = normalizeSearchKeyword(typedKeyRaw);
      if (!normalizedKey) {
        return null;
      }

      const startsWithMatches = normalizedSuggestions.filter((suggestion) =>
        suggestion.normalized.startsWith(normalizedKey)
      );

      const bestSuggestion = startsWithMatches[0]?.raw ?? null;

      if (!bestSuggestion) {
        return null;
      }

      return bestSuggestion;
    },
    [normalizedSuggestions]
  );

  const getExactSuggestionFor = useCallback(
    (typedKeyRaw: string): string | null => {
      const normalizedKey = normalizeSearchKeyword(typedKeyRaw);
      if (!normalizedKey) {
        return null;
      }

      const exactMatch = normalizedSuggestions.find(
        (suggestion) => suggestion.normalized === normalizedKey
      );

      return exactMatch?.raw ?? null;
    },
    [normalizedSuggestions]
  );

  const applyInlineAutocomplete = useCallback(
    (rawValue: string, rawCursorPosition: number, force = false) => {
      const info = getSegmentInfo(rawValue, rawCursorPosition, normalizedSuggestions);
      if (!info) {
        return { nextValue: rawValue, nextCursor: rawCursorPosition, selectionEnd: rawCursorPosition };
      }

      const typedKeyRaw = info.typedKeyRaw;
      const normalizedTypedKey = normalizeSearchKeyword(typedKeyRaw);
      if (!normalizedTypedKey) {
        return { nextValue: rawValue, nextCursor: rawCursorPosition, selectionEnd: rawCursorPosition };
      }

      const suggestion = getBestSuggestionFor(typedKeyRaw);
      const exactSuggestion = getExactSuggestionFor(typedKeyRaw);

      if (!suggestion && !exactSuggestion) {
        return { nextValue: rawValue, nextCursor: rawCursorPosition, selectionEnd: rawCursorPosition };
      }

      if (!suggestion && exactSuggestion && !info.hasColon) {
        const nextValue = `${rawValue.slice(0, info.keyEnd)}:${rawValue.slice(info.keyEnd)}`;
        const nextCursor = info.keyEnd + 1;

        return {
          nextValue,
          nextCursor,
          selectionEnd: nextCursor,
        };
      }

      if (!suggestion) {
        return { nextValue: rawValue, nextCursor: rawCursorPosition, selectionEnd: rawCursorPosition };
      }

      const typedAlreadyMatchesStart = normalizeSearchKeyword(suggestion).startsWith(normalizedTypedKey);
      if (!typedAlreadyMatchesStart && !force) {
        return { nextValue: rawValue, nextCursor: rawCursorPosition, selectionEnd: rawCursorPosition };
      }

      const shouldAppendColon = info.hasColon || force || normalizeSearchKeyword(suggestion) === normalizedTypedKey;
      let suffix = rawValue.slice(info.keyEnd);

      // When inline autocomplete already filled the remainder (e.g. "clu" -> "cluster id"
      // with "ster id" selected), committing with Tab should not duplicate that tail.
      if (!info.hasColon) {
        const suggestedRemainder = suggestion.slice(typedKeyRaw.length);
        if (suggestedRemainder && suffix.startsWith(suggestedRemainder)) {
          suffix = suffix.slice(suggestedRemainder.length);
        }
      }

      const separator = info.hasColon ? "" : shouldAppendColon ? ":" : "";

      const nextValue = `${rawValue.slice(0, info.keyStart)}${suggestion}${separator}${suffix}`;

      const selectionStart = info.keyStart + typedKeyRaw.length;
      const suggestionEnd = info.keyStart + suggestion.length;
      const completedCursor = suggestionEnd + (info.hasColon || shouldAppendColon ? 1 : 0);

      if (force) {
        return {
          nextValue,
          nextCursor: completedCursor,
          selectionEnd: completedCursor,
        };
      }

      if (!info.hasColon && normalizeSearchKeyword(suggestion) === normalizedTypedKey) {
        return {
          nextValue,
          nextCursor: completedCursor,
          selectionEnd: completedCursor,
        };
      }

      return {
        nextValue,
        nextCursor: selectionStart,
        selectionEnd: suggestionEnd,
      };
    },
    [getBestSuggestionFor, getExactSuggestionFor, normalizedSuggestions]
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = event.target.value;
      const rawCursorPosition = event.target.selectionStart ?? rawValue.length;

      if (suppressInlineAutocompleteRef.current) {
        suppressInlineAutocompleteRef.current = false;
        onValueChange(rawValue);
        setCursorPosition(rawCursorPosition);

        requestAnimationFrame(() => {
          const input = inputRef.current;
          if (!input) return;

          input.focus();
          input.setSelectionRange(rawCursorPosition, rawCursorPosition);
        });

        return;
      }

      const { nextValue, nextCursor, selectionEnd } = applyInlineAutocomplete(
        rawValue,
        rawCursorPosition
      );

      onValueChange(nextValue);
      setCursorPosition(nextCursor);

      requestAnimationFrame(() => {
        const input = inputRef.current;
        if (!input) return;

        input.focus();
        input.setSelectionRange(nextCursor, selectionEnd);
      });
    },
    [applyInlineAutocomplete, onValueChange]
  );

  const handleInputFocus = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      updateCursorPosition(event.target);
    },
    [updateCursorPosition]
  );

  const handleInputClick = useCallback(
    (event: React.MouseEvent<HTMLInputElement>) => {
      updateCursorPosition(event.currentTarget);
    },
    [updateCursorPosition]
  );

  const handleInputBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      setCursorPosition(event.target.selectionStart ?? event.target.value.length);
    },
    []
  );

  const handleInputKeyUp = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      updateCursorPosition(event.currentTarget);
    },
    [updateCursorPosition]
  );

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Backspace" || event.key === "Delete") {
        suppressInlineAutocompleteRef.current = true;
      }

      const isTabCommit = event.key === "Tab" && !event.shiftKey;
      const isEnterCommit = event.key === "Enter";

      if (isTabCommit || isEnterCommit) {
        const cursor = event.currentTarget.selectionStart ?? event.currentTarget.value.length;
        const { nextValue, nextCursor, selectionEnd } = applyInlineAutocomplete(
          event.currentTarget.value,
          cursor,
          true
        );

        if (nextValue !== event.currentTarget.value) {
          event.preventDefault();
          onValueChange(nextValue);
          setCursorPosition(nextCursor);
          requestAnimationFrame(() => {
            const input = inputRef.current;
            if (!input) return;
            input.focus();
            input.setSelectionRange(nextCursor, selectionEnd);
          });
        }

        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.code === "Space") {
        event.preventDefault();
        const cursor = event.currentTarget.selectionStart ?? event.currentTarget.value.length;
        const { nextValue, nextCursor, selectionEnd } = applyInlineAutocomplete(
          event.currentTarget.value,
          cursor,
          true
        );

        if (nextValue !== event.currentTarget.value) {
          onValueChange(nextValue);
          setCursorPosition(nextCursor);
          requestAnimationFrame(() => {
            const input = inputRef.current;
            if (!input) return;
            input.focus();
            input.setSelectionRange(nextCursor, selectionEnd);
          });
        }
      }
    },
    [applyInlineAutocomplete, onValueChange]
  );

  return {
    handleInputBlur,
    handleInputChange,
    handleInputClick,
    handleInputFocus,
    handleInputKeyDown,
    handleInputKeyUp,
    inputRef,
  };
};
