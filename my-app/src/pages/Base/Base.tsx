import * as React from "react";
import { styled, useTheme } from "@mui/material/styles";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import CssBaseline from "@mui/material/CssBaseline";
import MuiAppBar, { AppBarProps as MuiAppBarProps } from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import StorageIcon from "@mui/icons-material/Storage";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import LogoutIcon from "@mui/icons-material/Logout";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import Tab from "./NavBar/Tab";
import logo from "../../assets/ffa-banner-logo.webp";
import { Typography, useMediaQuery } from "@mui/material";
import { useAuth } from "../../auth/AuthProvider";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useEffect } from "react";

const drawerWidth = 240;

const Main = styled("main", { shouldForwardProp: (prop) => prop !== "open" })<{
  open?: boolean;
  isMobile?: boolean;
}>(({ theme, open, isMobile }) => ({
  flexGrow: 1,
  transition: theme.transitions.create("margin", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginLeft: isMobile ? 0 : (open ? 0 : `-${drawerWidth}px`),
  width: "100%",
  paddingTop: "76px",
  paddingBottom: isMobile ? "60px" : 0,
}));

interface AppBarProps extends MuiAppBarProps {
  open?: boolean;
  isMobile?: boolean;
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== "open" && prop !== "isMobile",
})<AppBarProps>(({ theme, open, isMobile }) => ({
  backgroundColor: "#ffffff",
  color: "#000000",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
  borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
  transition: theme.transitions.create(["margin", "width"], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(!isMobile && open && {
    width: `calc(100% - ${drawerWidth}px)`,
    marginLeft: `${drawerWidth}px`,
    transition: theme.transitions.create(["margin", "width"], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const DrawerHeader = styled("div")(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
  justifyContent: "space-between",
  backgroundColor: "lightgray",
  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
}));

const LogoContainer = styled("div")({
  display: "flex",
  width: "100%",
  justifyContent: "start",
  alignItems: "center",
  padding: "12px 16px",
});

const LogoImage = styled("img")({
  width: "85%",
  height: "auto",
  transition: "transform 0.3s ease",
  "&:hover": {
    transform: "scale(1.02)",
  },
});

// Mobile Bottom Navigation
const MobileNavigation = styled(Box)(({ theme }) => ({
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  display: "flex",
  justifyContent: "space-around",
  backgroundColor: "#ffffff",
  boxShadow: "0 -2px 10px rgba(0, 0, 0, 0.1)",
  zIndex: 1000,
  height: "60px",
}));

export default function BasePage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [open, setOpen] = React.useState(!isMobile);
  const [tab, setTab] = React.useState("Delivery Schedule");
  const [pageTitle, setPageTitle] = React.useState("");
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Close drawer by default on mobile, open by default on desktop
  React.useEffect(() => {
    setOpen(!isMobile);
  }, [isMobile]);

  useEffect(() => {
    // Use full paths for comparison as location.pathname includes the base
    const currentPath = location.pathname;
    if (currentPath === "/clients") {
      setPageTitle("Clients");
      setTab("Clients");
    } else if (currentPath === "/calendar") { // Changed from /deliveries
      setPageTitle("Calendar");
      setTab("Calendar");
    } else if (currentPath === "/create-users") { // Changed from /users
      setPageTitle("Users"); // Keep title as Users maybe?
      setTab("Users");
    } else if (currentPath === "/delivery") { // Changed from /routes
      setPageTitle("Delivery"); // Keep title as Delivery?
      setTab("Delivery");
    } else if (currentPath.startsWith("/profile")) { // Handle profile page potentially with ID
      setPageTitle("Profile");
      // Decide if a tab should be active for profile, or maybe none?
      // setTab("Profile"); // Example: If there was a Profile tab
    } else {
      setPageTitle(""); // Default empty title
      // setTab(""); // Reset tab if needed
    }
  }, [location]);

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/"); // Redirect to home without full page reload
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const navItems = [
    { text: "Clients", icon: <StorageIcon />, link: "/clients" },
    { text: "Calendar", icon: <CalendarTodayIcon />, link: "/calendar" }, // Changed link and text? Keep text Calendar
    { text: "Users", icon: <AddCircleIcon />, link: "/create-users" }, // Changed link
    { text: "Delivery", icon: <LocalShippingIcon />, link: "/delivery" }, // Changed link
  ];

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <AppBar position="fixed" open={open} isMobile={isMobile}>
        <Toolbar sx={{ 
          display: "flex", 
          justifyContent: "space-between",
          height: "64px",
          padding: "0 24px"
        }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              onClick={handleDrawerOpen}
              edge="start"
              sx={{ 
                ...((open && !isMobile) && { display: "none" }),
                color: "rgb(37, 126, 104)",
                "&:hover": {
                  backgroundColor: "rgba(37, 126, 104, 0.08)"
                }
              }}
            >
              <MenuRoundedIcon />
            </IconButton>
          </Box>
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 600,
              color: "#000000",
              letterSpacing: "0.5px",
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: isMobile ? "1rem" : "1.25rem",
            }}
          >
            {pageTitle}
          </Typography>
          <Box sx={{ width: 40 }} /> {/* Spacer for balanced layout */}
        </Toolbar>
      </AppBar>
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          display: isMobile && !open ? 'none' : 'block',
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            backgroundColor: "rgba(217, 217, 217, 1)",
            color: "#000000",
            display: "flex",
            flexDirection: "column",
            boxShadow: "4px 0 10px rgba(0, 0, 0, 0.05)",
            border: "none",
          },
        }}
        variant={isMobile ? "temporary" : "persistent"}
        anchor="left"
        open={open}
        onClose={handleDrawerClose}
        ModalProps={{
          keepMounted: true, // Better mobile performance 
        }}
      >
        <DrawerHeader>
          <LogoContainer>
            <LogoImage src={logo} alt="Logo" />
          </LogoContainer>
          <IconButton 
            onClick={handleDrawerClose}
            sx={{ 
              color: "rgba(96, 97, 97, 1)",
              "&:hover": { 
                backgroundColor: "rgba(37, 126, 104, 0.08)" 
              },
              marginRight: "8px"
            }}
          >
            <MenuRoundedIcon />
          </IconButton>
        </DrawerHeader>
        <Divider sx={{ margin: "0 16px", backgroundColor: "rgba(0, 0, 0, 0.06)" }} />
        <List sx={{ padding: "16px 8px" }}>
          {navItems.map(({ text, icon, link }) => (
            <ListItem key={text} disablePadding sx={{ mb: 1 }}>
              <Tab
                text={text}
                icon={icon}
                link={link}
                tab={tab}
                setTab={setTab}
                setOpen={setOpen}
              />
            </ListItem>
          ))}
        </List>
        <List
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            padding: "16px",
            justifyContent: "end",
            marginTop: "auto",
          }}
        >
          <ListItem disablePadding>
            <ListItemButton
              onClick={handleLogout}
              aria-label="Logout"
              sx={{ 
                backgroundColor: "#c0d4c5",
                borderRadius: "8px",
                transition: "all 0.2s ease",
                padding: "10px 16px",
                "&:hover": { 
                  backgroundColor: "#aabdad",
                  transform: "translateY(-2px)"
                } 
              }}
            >
              <ListItemIcon>
                <LogoutIcon sx={{ color: "#257e68" }} />
              </ListItemIcon>
              <ListItemText 
                primary="Logout" 
                primaryTypographyProps={{ 
                  fontWeight: 500,
                  color: "rgb(85, 85, 85)"
                }} 
              />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>
      <Main open={open} isMobile={isMobile} sx={{ flexGrow: 1, p: 3 }}>
        <DrawerHeader />
        <Outlet />
      </Main>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <MobileNavigation>
          {navItems.map(({ text, icon, link }) => (
            <Box 
              key={text}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                color: tab === text ? "rgb(37, 126, 104)" : "rgb(85, 85, 85)",
                padding: '8px 0',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.04)',
                },
              }}
              onClick={() => {
                setTab(text);
                setOpen(false);
                navigate(link);
              }}
            >
              <Box sx={{ 
                fontSize: '1.5rem',
                transform: tab === text ? 'scale(1.1)' : 'scale(1)',
                transition: 'transform 0.2s ease',
              }}>
                {icon}
              </Box>
              <Typography 
                variant="caption" 
                sx={{ 
                  fontSize: '0.7rem',
                  fontWeight: tab === text ? 600 : 400,
                  mt: 0.5,
                  transition: 'font-weight 0.2s ease',
                }}
              >
                {text}
              </Typography>
            </Box>
          ))}
        </MobileNavigation>
      )}
    </Box>
  );
}
