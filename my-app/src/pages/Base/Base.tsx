import * as React from 'react';
import { styled, useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import CssBaseline from '@mui/material/CssBaseline';
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';  // ✅ Added this import
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import StorageIcon from '@mui/icons-material/Storage';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import Tab from './NavBar/Tab';
import logo from '../../assets/ffa-banner-logo.webp';
import { useAuth } from '../../auth/AuthProvider';
import { useNavigate } from 'react-router-dom';

const drawerWidth = 240;

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })<{
  open?: boolean;
}>(({ theme, open }) => ({
  flexGrow: 1,
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginLeft: open ? 0 : `-${drawerWidth}px`,
}));

interface AppBarProps extends MuiAppBarProps {
  open?: boolean;
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})<AppBarProps>(({ theme, open }) => ({
  backgroundColor: '#ffffff',
  color: '#000000',
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    width: `calc(100% - ${drawerWidth}px)`,
    marginLeft: `${drawerWidth}px`,
    transition: theme.transitions.create(['margin', 'width'], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}));

const LogoContainer = styled('div')({
  display: 'flex',
  width: '100%',
  justifyContent: 'start',
  alignItems: 'center',
});

const LogoImage = styled('img')({
  width: '85%',
  height: 'auto',
});

export default function BasePage({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState("Delivery Schedule");
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/'); // Redirect to home without full page reload
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" open={open}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={handleDrawerOpen}
            edge="start"
            sx={{ marginRight: 2, ...(open && { display: 'none' }) }}
          >
            <MenuRoundedIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            backgroundColor: 'rgba(217, 217, 217, 1)',
            color: '#000000',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
        variant="persistent"
        anchor="left"
        open={open}
      >
        <DrawerHeader sx={{ backgroundColor: 'lightgray' }}>
          <LogoContainer>
            <LogoImage src={logo} alt="Logo" />
          </LogoContainer>
          <MenuRoundedIcon sx={{ fontSize: 30, color: "rgba(96, 97, 97, 1)" }} onClick={handleDrawerClose} />
        </DrawerHeader>
        <Divider />
        <List>
          {[
            { text: 'Delivery Schedule', icon: <CalendarTodayIcon />, link: '/calendar' },
            { text: 'Client Database', icon: <StorageIcon />, link: '/spreadsheet' },
            { text: 'Create Client', icon: <AccountCircleIcon />, link: '/profile' },
            { text: 'Add Volunteer', icon: <AddCircleIcon />, link: '/createUsers' },
            { text: 'Delivery Assignment', icon: <LocalShippingIcon />, link: '/deliveryAssignment' },
          ].map(({ text, icon, link }) => (
            <ListItem key={text} disablePadding>
              <Tab text={text} icon={icon} link={link} tab={tab} setTab={setTab} setOpen={setOpen} />
            </ListItem>
          ))}
        </List>
        <List sx={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'end' }}>
          <ListItem disablePadding>
            <ListItemButton onClick={handleLogout} aria-label="Logout" sx={{ backgroundColor: '#c0d4c5', '&:hover': { backgroundColor: '#aabdad' } }}>
              <ListItemIcon>
                <LogoutIcon sx={{ color: "#257e68" }} />
              </ListItemIcon>
              <ListItemText primary="Logout" />
            </ListItemButton>
          </ListItem>
        </List>
      </Drawer>
      <Main open={open}>
        <DrawerHeader />
        {children}
      </Main>
    </Box>
  );
}