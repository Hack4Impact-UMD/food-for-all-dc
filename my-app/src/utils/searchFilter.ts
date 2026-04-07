export interface SearchFilterConfig {
  checkStringContains: (value: any, query: string) => boolean;
  getSearchableFields: (searchValue: string) => boolean;
}

export const parseSearchTermsProgressively = (trimmedSearchQuery: string): string[] => {
  const searchTerms: string[] = [];
  let inQuote = false;
  let quoteChar = "";
  let currentTerm = "";

  const multiWordFilterPrefixes = new Set([
    "assigned",
    "cluster",
    "delivery",
    "last",
    "referral",
    "route",
    "tefap",
    "zip",
  ]);

  const pushCurrentTerm = (stripTrailingComma = false): void => {
    let normalizedTerm = currentTerm.trim();

    if (stripTrailingComma) {
      normalizedTerm = normalizedTerm.replace(/,\s*$/, "");
    }

    if (normalizedTerm) {
      searchTerms.push(normalizedTerm);
    }

    currentTerm = "";
  };

  const upcomingTokenContainsColon = (startIndex: number): boolean => {
    let index = startIndex;

    while (index < trimmedSearchQuery.length && trimmedSearchQuery[index] === " ") {
      index += 1;
    }

    while (
      index < trimmedSearchQuery.length &&
      trimmedSearchQuery[index] !== " " &&
      trimmedSearchQuery[index] !== ","
    ) {
      if (trimmedSearchQuery[index] === ":") {
        return true;
      }
      index += 1;
    }

    return false;
  };

  for (let i = 0; i < trimmedSearchQuery.length; i++) {
    const char = trimmedSearchQuery[i];
    const nextChar = i + 1 < trimmedSearchQuery.length ? trimmedSearchQuery[i + 1] : "";

    if (!inQuote && (char === '"' || char === "'")) {
      inQuote = true;
      quoteChar = char;
      currentTerm += char;
    } else if (inQuote && char === quoteChar) {
      currentTerm += char;
      inQuote = false;
      quoteChar = "";
    } else if (!inQuote && char === ",") {
      const trimmedCurrentTerm = currentTerm.trim();
      const colonIndex = trimmedCurrentTerm.indexOf(":");
      const valueAfterColon =
        colonIndex === -1 ? "" : trimmedCurrentTerm.substring(colonIndex + 1).trim();
      const nextTokenHasColon = upcomingTokenContainsColon(i + 1);

      if (colonIndex !== -1 && valueAfterColon !== "" && nextTokenHasColon) {
        pushCurrentTerm(false);
      } else {
        currentTerm += char;
      }
    } else if (!inQuote && char === " ") {
      const trimmedCurrentTerm = currentTerm.trim();
      const colonIndex = trimmedCurrentTerm.indexOf(":");
      const valueAfterColon =
        colonIndex === -1 ? "" : trimmedCurrentTerm.substring(colonIndex + 1).trim();
      const nextTokenHasColon = upcomingTokenContainsColon(i + 1);
      const endsWithComma = trimmedCurrentTerm.endsWith(",");
      const endsWithQuote = trimmedCurrentTerm.endsWith('"') || trimmedCurrentTerm.endsWith("'");
      const normalizedTerm = normalizeSearchKeyword(trimmedCurrentTerm);

      if (
        colonIndex === -1 &&
        !endsWithQuote &&
        nextTokenHasColon &&
        multiWordFilterPrefixes.has(normalizedTerm)
      ) {
        currentTerm += char;
      } else if (
        colonIndex !== -1 &&
        (valueAfterColon === "" || (endsWithComma && !nextTokenHasColon) || nextChar === '"' || nextChar === "'")
      ) {
        currentTerm += char;
      } else if (trimmedCurrentTerm) {
        pushCurrentTerm(endsWithComma && nextTokenHasColon);
      }
    } else {
      currentTerm += char;
    }
  }

  if (currentTerm.trim()) {
    searchTerms.push(currentTerm.trim());
  }

  return searchTerms.filter((term) => term.length > 0 && term !== '"' && term !== "'");
};

const normalizeSearchValue = (value: any): string => String(value).trim().toLowerCase();

export const checkStringContains = (value: any, query: string): boolean => {
  if (value === undefined || value === null) {
    return false;
  }
  return normalizeSearchValue(value).includes(normalizeSearchValue(query));
};

export const checkStringEquals = (value: any, query: string): boolean => {
  if (value === undefined || value === null) {
    return false;
  }

  const normalizedValue = normalizeSearchValue(value);
  const normalizedQuery = normalizeSearchValue(query);

  if (normalizedValue === normalizedQuery) {
    return true;
  }

  const valueNumberTokens: string[] = normalizedValue.match(/\d+/g) ?? [];
  const queryNumberTokens: string[] = normalizedQuery.match(/\d+/g) ?? [];

  if (queryNumberTokens.length === 1 && valueNumberTokens.length > 0) {
    return valueNumberTokens.includes(queryNumberTokens[0]);
  }

  return false;
};

const stripWrappingQuotes = (value: string): string => {
  const trimmedValue = value.trim();

  if (
    (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
    (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
  ) {
    return trimmedValue.slice(1, -1).trim();
  }

  return trimmedValue;
};

export const splitFilterValues = (searchValue: string): string[] => {
  const values: string[] = [];
  let currentValue = "";
  let inQuote = false;
  let quoteChar = "";

  for (let i = 0; i < searchValue.length; i++) {
    const char = searchValue[i];

    if (!inQuote && (char === '"' || char === "'")) {
      inQuote = true;
      quoteChar = char;
      currentValue += char;
    } else if (inQuote && char === quoteChar) {
      currentValue += char;
      inQuote = false;
      quoteChar = "";
    } else if (!inQuote && char === ",") {
      const normalizedValue = stripWrappingQuotes(currentValue);
      if (normalizedValue) {
        values.push(normalizedValue);
      }
      currentValue = "";
    } else {
      currentValue += char;
    }
  }

  const normalizedValue = stripWrappingQuotes(currentValue);
  if (normalizedValue) {
    values.push(normalizedValue);
  }

  return values;
};

export const normalizeSearchKeyword = (value: string): string =>
  value.toLowerCase().replace(/[\s_]+/g, "");

export const isPartialFieldName = (term: string, fieldNames: string[]): boolean => {
  const lowerTerm = term.toLowerCase();
  return fieldNames.some(
    (fieldName) =>
      fieldName.startsWith(lowerTerm) ||
      lowerTerm.startsWith(fieldName.substring(0, Math.min(3, fieldName.length)))
  );
};

export const extractKeyValue = (
  term: string
): { keyword: string; searchValue: string; isKeyValue: boolean } => {
  const colonIndex = term.indexOf(":");

  if (colonIndex !== -1) {
    let searchValue = term.substring(colonIndex + 1).trim();

    if (!searchValue.includes(",")) {
      searchValue = stripWrappingQuotes(searchValue);
    }

    return {
      keyword: term.substring(0, colonIndex).trim().toLowerCase(),
      searchValue: searchValue,
      isKeyValue: true,
    };
  }

  return {
    keyword: "",
    searchValue: "",
    isKeyValue: false,
  };
};

export const globalSearchMatch = (
  row: any,
  searchValue: string,
  searchableFields: string[]
): boolean => {
  const lowerSearch = searchValue.toLowerCase();

  return searchableFields.some((field) => {
    const value = field.split(".").reduce((obj, key) => obj?.[key], row);
    if (value === undefined || value === null) return false;

    if (Array.isArray(value)) {
      return value.some((item) => String(item).toLowerCase().includes(lowerSearch));
    }

    return String(value).toLowerCase().includes(lowerSearch);
  });
};
