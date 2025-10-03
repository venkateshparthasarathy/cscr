import React, { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, AppBar, Toolbar, Typography, Container, Tabs, Tab, Box } from '@mui/material';
import Scanner from './components/Scanner';
import AdminPanel from './components/AdminPanel';
import ParticipantsView from './components/ParticipantsView';
import AdminLogin from './components/AdminLogin';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function App() {
  const [tabValue, setTabValue] = useState(0);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  const handleTabChange = (event, newValue) => {
    // Don't allow access to admin tabs without login
    if ((newValue === 1 || newValue === 2) && !isAdminLoggedIn) {
      setTabValue(3); // Redirect to login tab
    } else {
      setTabValue(newValue);
    }
  };

  const handleAdminLogin = () => {
    setIsAdminLoggedIn(true);
    setTabValue(1); // Redirect to admin panel after login
  };

  const handleAdminLogout = () => {
    setIsAdminLoggedIn(false);
    setTabValue(0); // Redirect to scanner after logout
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Annual Symposium CELL & GENE THERAPY - Food Court Management
          </Typography>
          {isAdminLoggedIn && (
            <Typography variant="body2" sx={{ mr: 2 }}>
              Admin Mode
            </Typography>
          )}
        </Toolbar>
      </AppBar>
      
      <Container maxWidth="lg">
        <Tabs value={tabValue} onChange={handleTabChange} centered sx={{ mb: 2 }}>
          <Tab label="Scanner" />
          <Tab label="Admin Panel" disabled={!isAdminLoggedIn} />
          <Tab label="View Participants" disabled={!isAdminLoggedIn} />
          <Tab label={isAdminLoggedIn ? "Logout" : "Admin Login"} />
        </Tabs>

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
            <Box textAlign="center">
              <Typography variant="h6" gutterBottom>
                Are you sure you want to logout?
              </Typography>
              <button 
                onClick={handleAdminLogout}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer'
                }}
              >
                Logout
              </button>
            </Box>
          ) : (
            <AdminLogin onLogin={handleAdminLogin} />
          )}
        </TabPanel>
      </Container>
    </ThemeProvider>
  );
}

export default App;