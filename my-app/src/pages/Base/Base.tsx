import React, { useState, useMemo, useEffect } from "react";
import type { ImgHTMLAttributes } from "react";
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
import DeleteIcon from "@mui/icons-material/Delete";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import AssessmentIcon from "@mui/icons-material/Assessment";
import DescriptionIcon from "@mui/icons-material/Description";
import Tab from "./NavBar/Tab";
import logo from "../../assets/ffa-banner-logo.webp";
import { Typography, useMediaQuery, MenuItem, Select } from "@mui/material";
import { useAuth } from "../../auth/AuthProvider";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { UserType } from "../../types";

const drawerWidth = "20%";

const Main = styled("main", { shouldForwardProp: (prop) => prop !== "open" })<{
  open?: boolean;
  isMobile?: boolean;
}>(({ theme, open, isMobile }) => ({
  flexGrow: 1,
  transition: theme.transitions.create("margin", {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginLeft: isMobile ? 0 : open ? 0 : `-${drawerWidth}`,
  width: "100%",
  marginTop: "10vh",
  paddingBottom: isMobile ? "60px" : 0,
}));

interface AppBarProps extends MuiAppBarProps {
  open?: boolean;
  isMobile?: boolean;
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== "open" && prop !== "isMobile",
})<AppBarProps>(({ theme, open, isMobile }) => ({
  backgroundColor: "var(--color-background-main)",
  color: "var(--color-border-black)",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
  borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
  transition: theme.transitions.create(["margin", "width"], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(!isMobile &&
    open && {
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

export default function BasePage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("Delivery Schedule");
  const [pageTitle, setPageTitle] = useState("");
  const { logout, name, userRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Use full paths for comparison as location.pathname includes the base
    const currentPath = location.pathname;
    if (currentPath === "/clients") {
      setPageTitle("Clients");
      setTab("Clients");
    } else if (currentPath === "/calendar") {
      setPageTitle("Calendar");
      setTab("Calendar");
    } else if (currentPath === "/users") {
      setPageTitle("Users");
      setTab("Users");
    } else if (currentPath === "/routes") {
      setPageTitle("Routes");
      setTab("Routes");
    } else if (currentPath.startsWith("/reports")) {
      // Handle reports routes
      if (currentPath === "/reports/summary") {
        setPageTitle("Summary Report");
      } else if (currentPath === "/reports/clients") {
        setPageTitle("Client Report");
      } else if (currentPath === "/reports/referral-agencies") {
        setPageTitle("Referral Agencies");
      }
      // else if (currentPath === "/reports/caseworker") {
      //   setPageTitle("Caseworker Report");
      // }
      else {
        setPageTitle("Reports");
      }
      setTab("Reports");
    } else if (currentPath.startsWith("/profile")) {
      setPageTitle("Profile");
    } else {
      setPageTitle("");
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

  // Define base navigation items
  const baseNavItems = [
    { text: "Clients", icon: <StorageIcon />, link: "/clients" },
    { text: "Calendar", icon: <CalendarTodayIcon />, link: "/calendar" },
    // Delivery item added conditionally below
  ];

  // Conditionally add items based on role
  const navItems = useMemo(() => {
    const items = [...baseNavItems];

    items.push({ text: "Routes", icon: <LocalShippingIcon />, link: "/routes" });

    if (userRole === UserType.Admin || userRole === UserType.Manager) {
      items.push({ text: "Users", icon: <AddCircleIcon />, link: "/users" });
    }

    items.push({ text: "Reports", icon: <AssessmentIcon />, link: "/reports/summary" });

    return items;
  }, [userRole]);

  return (
    <Box sx={{ display: "flex" }}>
      <CssBaseline />
      <AppBar position="fixed" open={open} isMobile={isMobile}>
        <Toolbar
          sx={{
            display: "flex",
            justifyContent: "space-between",
            height: "64px",
            padding: "0 24px",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              onClick={handleDrawerOpen}
              edge="start"
              sx={{
                ...(open && !isMobile && { display: "none" }),
                color: "rgb(37, 126, 104)",
                "&:hover": {
                  backgroundColor: "rgba(37, 126, 104, 0.08)",
                },
              }}
            >
              <MenuRoundedIcon />
            </IconButton>
          </Box>
          <Box
            sx={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              alignItems: "center",
            }}
          >
            {location.pathname.startsWith("/reports") ? (
              <Select
                value={location.pathname}
                onChange={(e) => navigate(e.target.value)}
                variant="standard"
                disableUnderline
                sx={{
                  "& .MuiSelect-select": {
                    fontWeight: 600,
                    color: "var(--color-border-black)",
                    letterSpacing: "0.5px",
                    fontSize: isMobile ? "1rem" : "1.25rem",
                    padding: 0,
                    border: "none",
                    "&:focus": {
                      backgroundColor: "var(--color-transparent)",
                    },
                  },
                  "& .MuiSelect-icon": {
                    color: "var(--color-border-black)",
                    fontSize: isMobile ? "1.2rem" : "1.5rem",
                  },
                  "& fieldset": {
                    border: "none",
                  },
                }}
              >
                <MenuItem value="/reports/summary">Summary Report</MenuItem>
                <MenuItem value="/reports/clients">Client Report</MenuItem>
                <MenuItem value="/reports/referral-agencies">Referral Agencies</MenuItem>
                {/* <MenuItem value="/reports/caseworker">Caseworker Report</MenuItem> */}
              </Select>
            ) : (
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  color: "var(--color-border-black)",
                  letterSpacing: "0.5px",
                  fontSize: isMobile ? "1rem" : "1.25rem",
                }}
              >
                {pageTitle}
              </Typography>
            )}
          </Box>
          <Box sx={{ width: 40 }} /> {/* Spacer for balanced layout */}
        </Toolbar>
      </AppBar>
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          display: isMobile && !open ? "none" : "block",
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            backgroundColor: "rgba(217, 217, 217, 1)",
            color: "var(--color-border-black)",
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
                backgroundColor: "rgba(37, 126, 104, 0.08)",
              },
              marginRight: "8px",
            }}
          >
            <MenuRoundedIcon />
          </IconButton>
        </DrawerHeader>
        <Divider sx={{ margin: "0 16px", backgroundColor: "rgba(0, 0, 0, 0.06)" }} />
        <List sx={{ padding: "16px 8px", flexGrow: 1 }}>
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
        <Typography
          sx={{ padding: "8px" }}
        >{`Logged in as: ${name} (${userRole ?? "Unknown"})`}</Typography>
        <Divider sx={{ margin: "0 16px", backgroundColor: "rgba(0, 0, 0, 0.06)" }} />
        <List sx={{ padding: "0 8px", width: "100%" }}>
          <ListItem key="Documentation" disablePadding sx={{ mb: 1 }}>
            <Box sx={{ width: "100%" }}>
              <a
                href="https://docs.google.com/document/d/1cHri2wCaWSghYgxS-Kknjv5ZB26JuuAfzd85ayXLWbM/edit?tab=t.0"
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: "none", width: "100%" }}
              >
                <Tab
                  text="Documentation"
                  icon={<DescriptionIcon />}
                  link="#"
                  tab={tab}
                  setTab={() => undefined}
                  setOpen={() => undefined}
                />
              </a>
            </Box>
          </ListItem>
        </List>
        <List sx={{ padding: "8px" }}>
          <ListItem key="Logout" disablePadding>
            <ListItemButton
              onClick={handleLogout}
              sx={{
                backgroundColor: "#c0d4c5",
                borderRadius: "8px",
                transition: "all 0.2s ease",
                padding: "10px 16px",
                "&:hover": {
                  backgroundColor: "#aabdad",
                  transform: "translateY(-2px)",
                },
              }}
            >
              <ListItemIcon>
                <LogoutIcon sx={{ color: "var(--color-primary)" }} />
              </ListItemIcon>
              <ListItemText
                primary="Logout"
                primaryTypographyProps={{
                  fontWeight: 500,
                  color: "rgb(85, 85, 85)",
                }}
              />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>
      <Main open={open} isMobile={isMobile}>
        <Outlet />
      </Main>
    </Box>
  );
}
