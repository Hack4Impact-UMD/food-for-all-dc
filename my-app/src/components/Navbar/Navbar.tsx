import React from 'react';
import { Drawer, List, ListItemButton, ListItemText, CssBaseline, AppBar, Toolbar, Typography, Divider } from '@mui/material';

const drawerWidth = 240;

interface NavbarProps {
    open: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ open }) => {
    return (
        <div style={{ display: 'flex' }}>
            <CssBaseline />
            <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
                <Toolbar>
                    <Typography variant="h6" noWrap>
                        Persistent Drawer
                    </Typography>
                </Toolbar>
            </AppBar>
            {open && (
                <Drawer
                    sx={{
                        width: drawerWidth,
                        flexShrink: 0,
                        '& .MuiDrawer-paper': {
                            width: drawerWidth,
                        },
                    }}
                    variant="permanent"
                    anchor="left"
                >
                    <Toolbar />
                    <Divider />
                    <List>
                        <ListItemButton>
                            <ListItemText primary="Home" />
                        </ListItemButton>
                        <ListItemButton>
                            <ListItemText primary="About" />
                        </ListItemButton>
                        <ListItemButton>
                            <ListItemText primary="Contact" />
                        </ListItemButton>
                    </List>
                </Drawer>
            )}
            <main style={{ flexGrow: 1, padding: '16px' }}>
                <Toolbar />
                <Typography paragraph>
                    Content goes here.
                </Typography>
            </main>
        </div>
    );
};

export default Navbar;