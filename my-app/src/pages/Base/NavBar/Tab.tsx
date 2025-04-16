import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import { useNavigate } from "react-router-dom";
import "../NavBar/Tab.css";
import { Box, useMediaQuery, useTheme } from "@mui/material";

interface TabProp {
  text: string;
  icon: React.ReactNode;
  link: string;
  tab: string;
  setTab: (text: string) => void;
  setOpen: (open: boolean) => void;
}
export default function Tab({ text, icon, link, tab, setTab, setOpen }: TabProp) {
  const navigate = useNavigate();
  const isActive = tab === text;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box
      className={
        text === "Logout" ? "tabContainerLogout" : "tabContainer" + (isActive ? "Selected" : "")
      }
      sx={{
        borderRadius: "8px",
        display: "flex",
        width: "100%",
        alignItems: "center",
        padding: isMobile ? "8px 12px" : "10px 16px",
        transition: "all 0.2s ease",
        backgroundColor: isActive ? "rgba(80, 187, 106, 0.18)" : "transparent",
        "&:hover": {
          backgroundColor: isActive ? "rgba(80, 187, 106, 0.3)" : "rgb(232, 232, 232)",
          transform: "translateY(-2px)",
        },
      }}
      onClick={() => {
        setTab(text);
        setOpen(false);
        navigate(link);
      }}
    >
      <ListItemIcon 
        sx={{ 
          color: "rgb(37, 126, 104)",
          minWidth: isMobile ? "32px" : "40px" 
        }}
      >
        {icon}
      </ListItemIcon>
      <ListItemText 
        primary={text} 
        sx={{ 
          "& .MuiTypography-root": {
            fontWeight: isActive ? "600" : "500",
            fontSize: isMobile ? "0.85rem" : "0.95rem",
            color: "rgb(85, 85, 85)",
            transition: "color 0.2s ease",
          }
        }} 
      />
      {isActive && (
        <Box 
          sx={{
            width: "4px",
            height: isMobile ? "20px" : "24px",
            borderRadius: "2px",
            backgroundColor: "rgb(37, 126, 104)",
            marginLeft: "auto",
            transition: "all 0.3s ease",
          }}
        />
      )}
    </Box>
  );
}
