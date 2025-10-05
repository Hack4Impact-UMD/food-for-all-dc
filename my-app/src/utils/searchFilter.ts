export interface SearchFilterConfig {
  checkStringContains: (value: any, query: string) => boolean;
  getSearchableFields: (searchValue: string) => boolean;
}

export const parseSearchTermsProgressively = (trimmedSearchQuery: string): string[] => {
  const searchTerms: string[] = [];
  let inQuote = false;
  let quoteChar = '';
  let currentTerm = '';

  for (let i = 0; i < trimmedSearchQuery.length; i++) {
    const char = trimmedSearchQuery[i];

    if (!inQuote && (char === '"' || char === "'")) {
      if (currentTerm.trim()) {
        searchTerms.push(currentTerm.trim());
        currentTerm = '';
      }
      inQuote = true;
      quoteChar = char;
    } else if (inQuote && char === quoteChar) {
      if (currentTerm.trim()) {
        searchTerms.push(currentTerm.trim());
      }
      currentTerm = '';
      inQuote = false;
      quoteChar = '';
    } else if (!inQuote && char === ' ') {
      if (currentTerm.trim()) {
        searchTerms.push(currentTerm.trim());
        currentTerm = '';
      }
    } else {
      currentTerm += char;
    }
  }

  if (currentTerm.trim()) {
    searchTerms.push(currentTerm.trim());
  }

  return searchTerms.filter(term => term.length > 0 && term !== '"' && term !== "'");
};

export const checkStringContains = (value: any, query: string): boolean => {
  if (value === undefined || value === null) {
    return false;
  }
  return String(value).toLowerCase().includes(query.toLowerCase());
};

export const isPartialFieldName = (term: string, fieldNames: string[]): boolean => {
  const lowerTerm = term.toLowerCase();
  return fieldNames.some(fieldName =>
    fieldName.startsWith(lowerTerm) ||
    lowerTerm.startsWith(fieldName.substring(0, Math.min(3, fieldName.length)))
  );
};

export const extractKeyValue = (term: string): { keyword: string; searchValue: string; isKeyValue: boolean } => {
  const colonIndex = term.indexOf(':');

  if (colonIndex !== -1) {
    return {
      keyword: term.substring(0, colonIndex).trim().toLowerCase(),
      searchValue: term.substring(colonIndex + 1).trim(),
      isKeyValue: true
    };
  }

  return {
    keyword: '',
    searchValue: '',
    isKeyValue: false
  };
};
