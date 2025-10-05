import React, { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { 
  CssBaseline, 
  AppBar, 
  Toolbar, 
  Typography, 
  Container, 
  Tabs, 
  Tab, 
  Box,
  Paper,
  useScrollTrigger,
  Slide,
  Fab,
  Zoom
} from '@mui/material';
import { KeyboardArrowUp, Restaurant, AdminPanelSettings, People, QrCodeScanner } from '@mui/icons-material';
import Scanner from './components/Scanner';
import AdminPanel from './components/AdminPanel';
import ParticipantsView from './components/ParticipantsView';
import AdminLogin from './components/AdminLogin';

// Enhanced theme with beautiful color palette
const theme = createTheme({
  palette: {
    primary: {
      main: '#2563eb',
      light: '#60a5fa',
      dark: '#1d4ed8',
    },
    secondary: {
      main: '#7c3aed',
      light: '#a78bfa',
      dark: '#5b21b6',
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
    success: {
      main: '#10b981',
    },
    warning: {
      main: '#f59e0b',
    },
    error: {
      main: '#ef4444',
    },
  },
  typography: {
    h4: {
      fontWeight: 700,
      background: 'linear-gradient(45deg, #2563eb, #7c3aed)',
      backgroundClip: 'text',
      WebkitBackgroundClip: 'text',
      color: 'transparent',
    },
    h6: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          border: '1px solid #e2e8f0',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        },
      },
    },
  },
});

function HideOnScroll(props) {
  const { children } = props;
  const trigger = useScrollTrigger();

  return (
    <Slide appear={false} direction="down" in={!trigger}>
      {children}
    </Slide>
  );
}

function ScrollTop(props) {
  const { children } = props;
  const trigger = useScrollTrigger({
    disableHysteresis: true,
    threshold: 100,
  });

  const handleClick = (event) => {
    const anchor = (event.target.ownerDocument || document).querySelector(
      '#back-to-top-anchor',
    );
    if (anchor) {
      anchor.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  };

  return (
    <Zoom in={trigger}>
      <Box
        onClick={handleClick}
        role="presentation"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
      >
        {children}
      </Box>
    </Zoom>
  );
}

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box 
          sx={{ 
            p: 3,
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            minHeight: 'calc(100vh - 120px)',
          }}
        >
          {children}
        </Box>
      )}
    </div>
  );
}

function App() {
  const [tabValue, setTabValue] = useState(0);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  const handleTabChange = (event, newValue) => {
    if ((newValue === 1 || newValue === 2) && !isAdminLoggedIn) {
      setTabValue(3);
    } else {
      setTabValue(newValue);
    }
  };

  const handleAdminLogin = () => {
    setIsAdminLoggedIn(true);
    setTabValue(1);
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    setTabValue(0);
  };

  const tabIcons = [
    <QrCodeScanner sx={{ mr: 1 }} />,
    <AdminPanelSettings sx={{ mr: 1 }} />,
    <People sx={{ mr: 1 }} />,
    isAdminLoggedIn ? <AdminPanelSettings sx={{ mr: 1 }} /> : <AdminPanelSettings sx={{ mr: 1 }} />
  ];

  const tabLabels = [
    "Barcode Scanner",
    "Admin Panel", 
    "Participants",
    isAdminLoggedIn ? "Logout" : "Admin Login"
  ];

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <HideOnScroll>
        <AppBar position="sticky">
          <Toolbar>
            <Restaurant sx={{ mr: 2, fontSize: 32 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 700 }}>
              CELL & GENE THERAPY Symposium
            </Typography>
            <Typography variant="body2" sx={{ 
              opacity: 0.9,
              background: 'rgba(255,255,255,0.2)',
              px: 2,
              py: 0.5,
              borderRadius: 2,
              backdropFilter: 'blur(10px)'
            }}>
              Food Court Management
            </Typography>
          </Toolbar>
        </AppBar>
      </HideOnScroll>

      <div id="back-to-top-anchor" />
      
      <Container maxWidth="xl" sx={{ mt: 2 }}>
        <Paper 
          elevation={0}
          sx={{ 
            mb: 3,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: 3,
            overflow: 'hidden'
          }}
        >
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange} 
            centered 
            sx={{
              '& .MuiTab-root': {
                fontWeight: 600,
                fontSize: '0.9rem',
                py: 2,
                minHeight: '64px',
                '&.Mui-selected': {
                  color: '#2563eb',
                },
              },
              '& .MuiTabs-indicator': {
                background: 'linear-gradient(45deg, #2563eb, #7c3aed)',
                height: 3,
                borderRadius: 2,
              },
            }}
          >
            {tabLabels.map((label, index) => (
              <Tab 
                key={index}
                icon={tabIcons[index]}
                label={label}
                disabled={(index === 1 || index === 2) && !isAdminLoggedIn}
                sx={{
                  opacity: (index === 1 || index === 2) && !isAdminLoggedIn ? 0.5 : 1,
                }}
              />
            ))}
          </Tabs>
        </Paper>

        <TabPanel value={tabValue} index={0}>
          <Scanner />
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          {isAdminLoggedIn ? <AdminPanel onLogout={handleAdminLogout} /> : <AdminLogin onLogin={handleAdminLogin} />}
        </TabPanel>
        
        <TabPanel value={tabValue} index={2}>
          {isAdminLoggedIn ? <ParticipantsView /> : <AdminLogin onLogin={handleAdminLogin} />}
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          {isAdminLoggedIn ? (
            <Box 
              textAlign="center" 
              sx={{ 
                maxWidth: 400, 
                mx: 'auto',
                mt: 8 
              }}
            >
              <Paper
                sx={{
                  p: 4,
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  borderRadius: 3,
                }}
              >
                <Typography variant="h5" gutterBottom color="primary" fontWeight="600">
                  Ready to Logout?
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                  You are currently logged in as Administrator.
                </Typography>
                <button 
                  onClick={handleAdminLogout}
                  style={{
                    padding: '12px 32px',
                    background: 'linear-gradient(45deg, #ef4444, #dc2626)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: '600',
                    transition: 'all 0.2s ease-in-out',
                    boxShadow: '0 4px 6px -1px rgb(239 68 68 / 0.3)',
                  }}
                  onMouseOver={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 20px -1px rgb(239 68 68 / 0.4)';
                  }}
                  onMouseOut={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 6px -1px rgb(239 68 68 / 0.3)';
                  }}
                >
                  Logout
                </button>
              </Paper>
            </Box>
          ) : (
            <AdminLogin onLogin={handleAdminLogin} />
          )}
        </TabPanel>
      </Container>

      <ScrollTop>
        <Fab 
          size="medium" 
          aria-label="scroll back to top"
          sx={{
            background: 'linear-gradient(45deg, #2563eb, #7c3aed)',
            color: 'white',
            '&:hover': {
              background: 'linear-gradient(45deg, #1d4ed8, #5b21b6)',
              transform: 'translateY(-2px)',
            },
          }}
        >
          <KeyboardArrowUp />
        </Fab>
      </ScrollTop>
    </ThemeProvider>
  );
}

export default App;
