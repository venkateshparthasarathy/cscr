import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Chip,
  Grid,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  TextField,
  Autocomplete,
  MenuItem
} from '@mui/material';
import { CheckCircle, Cancel, QrCodeScanner, CameraAlt, Videocam, Smartphone, Close, Refresh } from '@mui/icons-material';
import axios from 'axios';
import jsQR from 'jsqr';

const Scanner = () => {
  const [scanResult, setScanResult] = useState('');
  const [participant, setParticipant] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [isCameraSupported, setIsCameraSupported] = useState(true);
  const [cameraPermission, setCameraPermission] = useState('prompt');
  const [showCameraHelp, setShowCameraHelp] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [scanDebug, setScanDebug] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [emailSuggestions, setEmailSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Check camera support
  useEffect(() => {
    checkCameraSupport();
    return () => stopScanner();
  }, []);

  // Load email suggestions when component mounts
  useEffect(() => {
    loadEmailSuggestions();
  }, []);

  const loadEmailSuggestions = async () => {
    try {
      setLoadingSuggestions(true);
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const response = await axios.get(`${API_BASE_URL}/api/participants`, {
        headers: getAuthHeader()
      });
      
      const suggestions = response.data.map(participant => ({
        label: participant.email,
        name: participant.name,
        mobile: participant.mobile
      }));
      
      setEmailSuggestions(suggestions);
      setScanDebug(`Loaded ${suggestions.length} email suggestions`);
    } catch (error) {
      console.error('Error loading suggestions:', error);
      setScanDebug('Failed to load email suggestions');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const getAuthHeader = () => {
    const credentials = btoa('cscr:cscr123$@');
    return { Authorization: `Basic ${credentials}` };
  };

  const checkCameraSupport = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsCameraSupported(false);
        setCameraError('Camera API not supported in this browser');
        return;
      }

      if (navigator.permissions) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'camera' });
          setCameraPermission(permissionStatus.state);
          permissionStatus.onchange = () => {
            setCameraPermission(permissionStatus.state);
          };
        } catch (e) {
          console.log('Permission API not supported');
        }
      }
    } catch (error) {
      console.error('Error checking camera support:', error);
    }
  };

  const startScanner = async () => {
    setIsLoading(true);
    setCameraError('');
    setError('');
    setScanResult('');
    setScanDebug('Starting scanner...');

    try {
      // Stop any existing scanner
      await stopScanner();

      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsScanning(true);
      setCameraPermission('granted');
      setScanDebug('Scanner started. Point camera at barcode...');

      // Start scanning loop
      scanFrame();

    } catch (err) {
      console.error('Scanner error:', err);
      handleCameraError(err);
      setScanDebug(`Scanner error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const scanFrame = () => {
    if (!isScanning || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        setScanDebug(`Scanned: ${code.data}`);
        handleScanResult(code.data);
      }
    }

    if (isScanning) {
      animationFrameRef.current = requestAnimationFrame(scanFrame);
    }
  };

  const stopScanner = async () => {
    setIsScanning(false);
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setScanDebug('Scanner stopped');
  };

  const handleCameraError = (error) => {
    let errorMessage = 'Camera access denied or not available';
    
    switch (error.name) {
      case 'NotAllowedError':
        errorMessage = 'Camera permission denied. Please allow camera access in your browser settings.';
        setCameraPermission('denied');
        break;
      case 'NotFoundError':
      case 'OverconstrainedError':
        errorMessage = 'No camera found or camera doesn\'t meet requirements.';
        break;
      case 'NotSupportedError':
        errorMessage = 'Camera not supported on this device.';
        setIsCameraSupported(false);
        break;
      case 'NotReadableError':
        errorMessage = 'Camera is already in use by another application.';
        break;
      default:
        errorMessage = `Camera error: ${error.message}`;
    }
    
    setCameraError(errorMessage);
    setScanDebug(`Camera error: ${errorMessage}`);
  };

  const handleScanResult = (decodedText) => {
    console.log('Barcode scanned:', decodedText);
    
    if (decodedText.includes('@') && decodedText.includes('.')) {
      setScanResult(decodedText);
      setSuccess('Barcode scanned successfully!');
      setTimeout(() => setSuccess(''), 3000);
      checkParticipant(decodedText);
      stopScanner(); // Stop after successful scan
    } else {
      setError('Scanned code does not appear to be a valid email address');
      setScanDebug(`Invalid format: ${decodedText}`);
    }
  };

  const handleManualSubmit = (email = null) => {
    const emailToCheck = email || manualEmail;
    if (emailToCheck && emailToCheck.includes('@')) {
      setScanResult(emailToCheck);
      checkParticipant(emailToCheck);
      if (!email) setManualEmail('');
    } else {
      setError('Please enter a valid email address');
    }
  };

  const checkParticipant = async (email) => {
    try {
      setScanDebug(`Checking participant: ${email}`);
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const response = await axios.get(`${API_BASE_URL}/api/participant/${email}`);
      setParticipant(response.data);
      setError('');
      setScanDebug(`Participant found: ${response.data.name}`);
    } catch (error) {
      setParticipant(null);
      setError('Participant not found in database');
      setScanDebug(`Participant not found: ${email}`);
    }
  };

  const markMealConsumed = async (day, mealType) => {
    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const response = await axios.put(`${API_BASE_URL}/api/participant/${scanResult}/meal`, {
        day,
        mealType
      });
      setParticipant(response.data);
      setSuccess(`${mealType} marked as consumed!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError('Error updating meal status');
    }
  };

  const getMealStatus = (day, mealType) => {
    if (!participant) return { consumed: false, timestamp: null };
    return participant.meals[day][mealType];
  };

  const MealButton = ({ day, mealType, label }) => {
    const meal = getMealStatus(day, mealType);
    
    return (
      <Button
        variant={meal.consumed ? "contained" : "outlined"}
        color={meal.consumed ? "success" : "primary"}
        onClick={() => markMealConsumed(day, mealType)}
        disabled={meal.consumed || !participant}
        fullWidth
        sx={{ mb: 1 }}
      >
        {label}
        {meal.consumed && <CheckCircle sx={{ ml: 1 }} />}
      </Button>
    );
  };

  const CameraHelpDialog = () => (
    <Dialog open={showCameraHelp} onClose={() => setShowCameraHelp(false)} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center">
          <CameraAlt sx={{ mr: 1 }} />
          Scanner Help
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="h6" gutterBottom>
          Barcode Scanner
        </Typography>

        <List>
          <ListItem>
            <ListItemIcon>
              <Smartphone />
            </ListItemIcon>
            <ListItemText 
              primary="Camera Access" 
              secondary="Ensure you allow camera permissions when prompted"
            />
          </ListItem>
          
          <ListItem>
            <ListItemIcon>
              <Videocam />
            </ListItemIcon>
            <ListItemText 
              primary="Good Lighting" 
              secondary="Ensure the barcode is well-lit without glare"
            />
          </ListItem>
          
          <ListItem>
            <ListItemIcon>
              <QrCodeScanner />
            </ListItemIcon>
            <ListItemText 
              primary="Use HTTPS" 
              secondary="Camera requires HTTPS. Use ngrok for local testing"
            />
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <Refresh />
            </ListItemIcon>
            <ListItemText 
              primary="Manual Entry" 
              secondary="Use the email autocomplete for quick manual entry"
            />
          </ListItem>
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowCameraHelp(false)}>Close</Button>
        <Button onClick={startScanner} variant="contained">
          Try Scanner
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box>
      <Typography variant="h4" gutterBottom align="center">
        Barcode Scanner
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Scanner Interface
              </Typography>

              {cameraError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {cameraError}
                  <Button 
                    size="small" 
                    onClick={() => setShowCameraHelp(true)}
                    sx={{ ml: 1 }}
                  >
                    Get Help
                  </Button>
                </Alert>
              )}

              {!isCameraSupported && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Camera not supported in this browser. Please use Chrome, Firefox, or Safari.
                </Alert>
              )}

              {cameraPermission === 'denied' && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Camera access denied. Please enable camera permissions in your browser settings.
                </Alert>
              )}
              
              <Box sx={{ mb: 2 }}>
                {!isScanning ? (
                  <Button
                    variant="contained"
                    startIcon={<QrCodeScanner />}
                    onClick={startScanner}
                    disabled={isLoading || !isCameraSupported}
                    fullWidth
                    size="large"
                  >
                    {isLoading ? (
                      <Box display="flex" alignItems="center">
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                        Starting Scanner...
                      </Box>
                    ) : (
                      'Start Barcode Scanner'
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    startIcon={<Close />}
                    onClick={stopScanner}
                    fullWidth
                    color="error"
                  >
                    Stop Scanner
                  </Button>
                )}
              </Box>

              {/* Scanner Container */}
              {isScanning && (
                <Box sx={{ mb: 2, position: 'relative' }}>
                  <video
                    ref={videoRef}
                    style={{ 
                      width: '100%',
                      height: '300px',
                      border: '2px solid #1976d2',
                      borderRadius: 1,
                      backgroundColor: '#000'
                    }}
                    playsInline
                    muted
                  />
                  <canvas
                    ref={canvasRef}
                    style={{ display: 'none' }}
                  />
                  <Box 
                    sx={{ 
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '300px',
                      height: '3px',
                      backgroundColor: '#ff4444',
                      opacity: 0.8,
                      animation: 'scanLine 2s ease-in-out infinite'
                    }}
                  />
                  <Typography 
                    variant="body2" 
                    align="center" 
                    sx={{ 
                      mt: 1, 
                      color: 'white',
                      backgroundColor: 'rgba(0,0,0,0.7)',
                      py: 1,
                      borderRadius: 1
                    }}
                  >
                    📷 Point camera at Code 128 barcode
                  </Typography>
                </Box>
              )}

              {/* Debug Info */}
              {scanDebug && (
                <Paper sx={{ p: 1, mb: 2, backgroundColor: '#f5f5f5' }}>
                  <Typography variant="caption" color="textSecondary">
                    Debug: {scanDebug}
                  </Typography>
                </Paper>
              )}

              {/* Manual Entry with Autocomplete */}
              <Paper sx={{ p: 2, textAlign: 'center', mt: 2 }}>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Manual Entry with Suggestions:
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <Autocomplete
                    freeSolo
                    options={emailSuggestions}
                    getOptionLabel={(option) => 
                      typeof option === 'string' ? option : option.label
                    }
                    renderOption={(props, option) => (
                      <MenuItem {...props}>
                        <Box>
                          <Typography variant="body1">
                            {option.label}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {option.name} • {option.mobile}
                          </Typography>
                        </Box>
                      </MenuItem>
                    )}
                    value={manualEmail}
                    onChange={(event, newValue) => {
                      if (newValue && typeof newValue === 'object') {
                        setManualEmail(newValue.label);
                        handleManualSubmit(newValue.label);
                      } else if (newValue && typeof newValue === 'string') {
                        setManualEmail(newValue);
                      }
                    }}
                    onInputChange={(event, newInputValue) => {
                      setManualEmail(newInputValue);
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Type email or select from suggestions"
                        size="small"
                        fullWidth
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <React.Fragment>
                              {loadingSuggestions ? (
                                <CircularProgress color="inherit" size={20} />
                              ) : null}
                              {params.InputProps.endAdornment}
                            </React.Fragment>
                          ),
                        }}
                      />
                    )}
                    sx={{ mb: 1 }}
                  />
                  
                  <Button
                    variant="outlined"
                    onClick={() => handleManualSubmit()}
                    disabled={!manualEmail || !manualEmail.includes('@')}
                    fullWidth
                  >
                    Search Participant
                  </Button>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Button
                    variant="outlined"
                    onClick={() => setShowCameraHelp(true)}
                    startIcon={<CameraAlt />}
                    size="small"
                  >
                    Scanner Help
                  </Button>
                  
                  <Button
                    variant="outlined"
                    onClick={loadEmailSuggestions}
                    startIcon={<Refresh />}
                    size="small"
                    disabled={loadingSuggestions}
                  >
                    {loadingSuggestions ? 'Loading...' : 'Refresh List'}
                  </Button>
                </Box>

                <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                  {emailSuggestions.length} participants available
                </Typography>
              </Paper>

              {scanResult && (
                <Box sx={{ mt: 2 }}>
                  <Chip 
                    label={`Scanned: ${scanResult}`}
                    color={participant ? "success" : "error"}
                    icon={participant ? <CheckCircle /> : <Cancel />}
                    onDelete={() => {
                      setScanResult('');
                      setParticipant(null);
                      setError('');
                    }}
                    deleteIcon={<Close />}
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Participant Details
              </Typography>

              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

              {participant ? (
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    <strong>Participant Information</strong>
                  </Typography>
                  <Typography><strong>Name:</strong> {participant.name}</Typography>
                  <Typography><strong>Mobile:</strong> {participant.mobile}</Typography>
                  <Typography><strong>Email:</strong> {participant.email}</Typography>
                  
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="h6" gutterBottom>Day 1 Meals</Typography>
                    <MealButton day="day1" mealType="morningSnack" label="Morning Snack" />
                    <MealButton day="day1" mealType="lunch" label="Lunch" />
                    <MealButton day="day1" mealType="eveningSnack" label="Evening Snack" />
                    <MealButton day="day1" mealType="dinner" label="Dinner" />

                    <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>Day 2 Meals</Typography>
                    <MealButton day="day2" mealType="morningSnack" label="Morning Snack" />
                    <MealButton day="day2" mealType="lunch" label="Lunch" />
                    <MealButton day="day2" mealType="eveningSnack" label="Evening Snack" />
                  </Box>
                </Box>
              ) : (
                <Typography color="textSecondary">
                  Scan a barcode or enter email to view participant details
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <CameraHelpDialog />

      {/* Add CSS for scanner animation */}
      <style>
        {`
          @keyframes scanLine {
            0% { transform: translate(-50%, -200%); }
            50% { transform: translate(-50%, 200%); }
            100% { transform: translate(-50%, -200%); }
          }
        `}
      </style>
    </Box>
  );
};

export default Scanner;
