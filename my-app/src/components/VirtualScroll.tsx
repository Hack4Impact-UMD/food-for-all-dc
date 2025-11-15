import React, { useState, useRef, useMemo } from "react";
import { Box } from "@mui/material";

interface VirtualScrollProps<T = unknown> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number; // Number of items to render outside visible area
}

const VirtualScroll = <T,>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
}: VirtualScrollProps<T>) => {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  // Calculate which items should be visible
  const visibleRange = useMemo(() => {
    const totalHeight = items.length * itemHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.floor((scrollTop + containerHeight) / itemHeight) + overscan
    );

    return {
      startIndex,
      endIndex,
      totalHeight,
      offsetY: startIndex * itemHeight,
    };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1);
  }, [items, visibleRange.startIndex, visibleRange.endIndex]);

  return (
    <Box
      ref={scrollElementRef}
      onScroll={handleScroll}
      sx={{
        height: containerHeight,
        overflowY: "auto",
        width: "100%",
      }}
    >
      {/* Total height container to maintain scrollbar */}
      <Box sx={{ height: visibleRange.totalHeight, position: "relative" }}>
        {/* Visible items container */}
        <Box
          sx={{
            position: "absolute",
            top: visibleRange.offsetY,
            width: "100%",
          }}
        >
          {visibleItems.map((item, index) => (
            <Box key={visibleRange.startIndex + index} sx={{ height: itemHeight }}>
              {renderItem(item, visibleRange.startIndex + index)}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default VirtualScroll;
