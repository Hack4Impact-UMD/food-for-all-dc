import React from "react";
import { Box, Skeleton, AppBar, Toolbar } from "@mui/material";

export const CalendarHeaderSkeleton: React.FC = () => {
  return (
    <AppBar position="static" color="default" elevation={1}>
      <Toolbar sx={{ justifyContent: "space-between", px: 2 }}>
        {/* Left side - Navigation buttons */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Skeleton variant="circular" width={40} height={40} />
          <Skeleton variant="circular" width={40} height={40} />
          <Skeleton variant="rectangular" width={80} height={36} sx={{ borderRadius: 1 }} />
        </Box>

        {/* Center - Date/Title */}
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Skeleton variant="text" width={200} height={32} />
          <Skeleton variant="text" width={100} height={20} />
        </Box>

        {/* Right side - View controls and add button */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Skeleton variant="rectangular" width={100} height={36} sx={{ borderRadius: 1 }} />
          <Skeleton variant="circular" width={40} height={40} />
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default CalendarHeaderSkeleton;
