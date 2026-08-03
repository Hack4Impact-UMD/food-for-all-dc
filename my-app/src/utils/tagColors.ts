export type TagColorMap = Record<string, string>;

export const DEFAULT_TAG_COLOR = "#257e68";
export const DEFAULT_TAG_COLOR_PALETTE = [
  "#257e68",
  "#1976d2",
  "#7b1fa2",
  "#c2185b",
  "#d84315",
  "#f9a825",
  "#546e7a",
  "#5d4037",
];

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export const normalizeTagColor = (color: unknown): string =>
  typeof color === "string" && HEX_COLOR_PATTERN.test(color)
    ? color.toLowerCase()
    : DEFAULT_TAG_COLOR;

export const normalizeTagColors = (colors: unknown): TagColorMap => {
  if (!colors || typeof colors !== "object" || Array.isArray(colors)) return {};

  return Object.fromEntries(
    Object.entries(colors as Record<string, unknown>)
      .filter(([tag]) => tag.trim() !== "")
      .map(([tag, color]) => [tag, normalizeTagColor(color)])
  );
};

export const normalizeTagColorPalette = (palette: unknown): string[] =>
  DEFAULT_TAG_COLOR_PALETTE.map((defaultColor, index) => {
    const savedColor = Array.isArray(palette) ? palette[index] : undefined;
    return typeof savedColor === "string" && HEX_COLOR_PATTERN.test(savedColor)
      ? savedColor.toLowerCase()
      : defaultColor;
  });

export const updateTagColorPaletteSlot = (
  palette: string[],
  index: number,
  color: string
): string[] =>
  normalizeTagColorPalette(palette).map((currentColor, currentIndex) =>
    currentIndex === index ? normalizeTagColor(color) : currentColor
  );

export const getTagColor = (tag: string, colors: TagColorMap): string =>
  normalizeTagColor(colors[tag]);

export const editTagMetadata = (
  tags: string[],
  colors: TagColorMap,
  oldTag: string,
  newTag: string,
  newColor: string
): { tags: string[]; tagColors: TagColorMap } => {
  const updatedTags = Array.from(
    new Set(tags.map((tag) => (tag === oldTag ? newTag : tag)))
  ).sort((left, right) => left.localeCompare(right));
  const updatedTagColors = { ...colors };
  delete updatedTagColors[oldTag];
  updatedTagColors[newTag] = normalizeTagColor(newColor);

  return { tags: updatedTags, tagColors: updatedTagColors };
};

export const getReadableTagTextColor = (backgroundColor: string): "#ffffff" | "#000000" => {
  const color = normalizeTagColor(backgroundColor).slice(1);
  const channels = [color.slice(0, 2), color.slice(2, 4), color.slice(4, 6)].map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;

  return blackContrast >= whiteContrast ? "#000000" : "#ffffff";
};
