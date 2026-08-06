export const normalizeDeliveryTags = (tags: unknown): string[] =>
  Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === "string") : [];
