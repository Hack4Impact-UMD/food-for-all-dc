export const CLUSTER_COLORS = [
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#FFFF00",
  "#FF00FF",
  "#00FFFF",
  "#FFA500",
  "#800080",
  "#008000",
  "#000080",
  "#FF4500",
  "#4B0082",
  "#FF6347",
  "#32CD32",
  "#9370DB",
  "#FF69B4",
  "#40E0D0",
  "#FF8C00",
  "#7CFC00",
  "#8A2BE2",
  "#FF1493",
  "#1E90FF",
  "#228B22",
  "#9400D3",
  "#DC143C",
  "#20B2AA",
  "#9932CC",
  "#FFD700",
  "#8B0000",
  "#4169E1",
] as const;

export const getClusterColor = (clusterId: unknown): string => {
  const clusterIdString = String(clusterId ?? "").trim();
  if (!clusterIdString) return "#ffffff";

  const match = clusterIdString.match(/\d+/);
  const clusterNumber = match ? parseInt(match[0], 10) : NaN;
  if (!Number.isNaN(clusterNumber) && clusterNumber > 0) {
    return CLUSTER_COLORS[(clusterNumber - 1) % CLUSTER_COLORS.length];
  }

  let hash = 0;
  for (let index = 0; index < clusterIdString.length; index += 1) {
    hash = clusterIdString.charCodeAt(index) + ((hash << 5) - hash);
  }

  return CLUSTER_COLORS[Math.abs(hash) % CLUSTER_COLORS.length];
};

export const getClusterTextColor = (backgroundColor: string): string => {
  const hex = backgroundColor.replace("#", "");
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.5 ? "#000000" : "#ffffff";
};
