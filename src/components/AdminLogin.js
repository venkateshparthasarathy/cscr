import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Paper,
  Fade
} from '@mui/material';
import { Lock, Security, Restaurant } from '@mui/icons-material';
import axios from 'axios';

const AdminLogin = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('http://localhost:5000/api/admin/login', credentials);
      
      if (response.data.message === 'Login successful') {
        onLogin();
      } else {
        setError('Login failed. Please try again.');
      }
    } catch (error) {
      console.error('Login error:', error);
      if (error.response) {
        setError(error.response.data.error || 'Invalid credentials. Please try again.');
      } else if (error.request) {
        setError('No response from server. Please check if the server is running.');
      } else {
        setError('An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Fade in={true} timeout={800}>
      <Box sx={{ 
        maxWidth: 440, 
        mx: 'auto', 
        mt: 2,
        mb: 4
      }}>
        <Card
          sx={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            border: '1px solid #e2e8f0',
            borderRadius: 3,
            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
            overflow: 'hidden',
          }}
        >
          {/* Header Section */}
          <Box
            sx={{
              background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
              color: 'white',
              textAlign: 'center',
              py: 3,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: -50,
                right: -50,
                width: 120,
                height: 120,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                bottom: -30,
                left: -30,
                width: 100,
                height: 100,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
              }}
            />
            <Lock sx={{ fontSize: 48, mb: 1, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))' }} />
            <Typography variant="h4" fontWeight="700" gutterBottom>
              Admin Portal
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9 }}>
              CELL & GENE THERAPY Symposium
            </Typography>
          </Box>

          <CardContent sx={{ p: 4 }}>
            {error && (
              <Alert 
                severity="error" 
                sx={{ 
                  mb: 3,
                  borderRadius: 2,
                  alignItems: 'center',
                }}
                icon={<Security />}
              >
                {error}
              </Alert>
            )}

            <form onSubmit={handleLogin}>
              <TextField
                fullWidth
                label="Username"
                name="username"
                value={credentials.username}
                onChange={handleInputChange}
                margin="normal"
                required
                autoComplete="username"
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&:hover fieldset': {
                      borderColor: '#2563eb',
                    },
                  },
                }}
              />
              <TextField
                fullWidth
                label="Password"
                name="password"
                type="password"
                value={credentials.password}
                onChange={handleInputChange}
                margin="normal"
                required
                autoComplete="current-password"
                sx={{
                  mb: 3,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    '&:hover fieldset': {
                      borderColor: '#2563eb',
                    },
                  },
                }}
              />
              
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                disabled={loading}
                sx={{
                  py: 1.5,
                  borderRadius: 2,
                  background: 'linear-gradient(45deg, #2563eb, #7c3aed)',
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  boxShadow: '0 4px 6px -1px rgb(37 99 235 / 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #1d4ed8, #5b21b6)',
                    boxShadow: '0 6px 20px -1px rgb(37 99 235 / 0.4)',
                    transform: 'translateY(-1px)',
                  },
                  '&:disabled': {
                    background: '#94a3b8',
                  },
                }}
              >
                {loading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box 
                      sx={{ 
                        width: 20, 
                        height: 20, 
                        border: '2px solid transparent',
                        borderTop: '2px solid white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        mr: 1
                      }} 
                    />
                    Authenticating...
                  </Box>
                ) : (
                  'Access Admin Panel'
                )}
              </Button>
            </form>

            {/* Credentials Hint */}
            <Paper
              sx={{
                mt: 3,
                p: 2,
                background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                borderRadius: 2,
                border: '1px solid #cbd5e1',
              }}
            >
              <Typography 
                variant="caption" 
                color="text.secondary" 
                sx={{ 
                  display: 'block', 
                  textAlign: 'center',
                  fontWeight: '500',
                }}
              >
                <Security sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-bottom' }} />
                Default Credentials: 
                <Box component="span" sx={{ fontFamily: 'monospace', ml: 1, color: '#1e293b' }}>
                  cscr / cscr123$@
                </Box>
              </Typography>
            </Paper>
          </CardContent>
        </Card>

        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </Box>
    </Fade>
  );
};

export default AdminLogin;
