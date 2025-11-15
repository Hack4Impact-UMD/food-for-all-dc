export interface SearchFilterConfig {
  checkStringContains: (value: any, query: string) => boolean;
  getSearchableFields: (searchValue: string) => boolean;
}

export const parseSearchTermsProgressively = (trimmedSearchQuery: string): string[] => {
  const searchTerms: string[] = [];
  let inQuote = false;
  let quoteChar = "";
  let currentTerm = "";

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
    } else if (!inQuote && char === " ") {
      const hasColon = currentTerm.includes(":");
      const nextIsQuote = nextChar === '"' || nextChar === "'";

      if (hasColon && nextIsQuote) {
        currentTerm += char;
      } else if (currentTerm.trim()) {
        searchTerms.push(currentTerm.trim());
        currentTerm = "";
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

export const checkStringContains = (value: any, query: string): boolean => {
  if (value === undefined || value === null) {
    return false;
  }
  return String(value).toLowerCase().includes(query.toLowerCase());
};

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

    if (
      (searchValue.startsWith('"') && searchValue.endsWith('"')) ||
      (searchValue.startsWith("'") && searchValue.endsWith("'"))
    ) {
      searchValue = searchValue.slice(1, -1);
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
