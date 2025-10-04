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
  MenuItem,
  IconButton
} from '@mui/material';
import { CheckCircle, Cancel, QrCodeScanner, CameraAlt, Videocam, Smartphone, Close, Refresh } from '@mui/icons-material';
import axios from 'axios';

// Import ZXing library
import { BrowserMultiFormatReader, Exception, NotFoundException } from '@zxing/library';

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
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const streamRef = useRef(null);

  // Initialize ZXing reader
  useEffect(() => {
    codeReaderRef.current = new BrowserMultiFormatReader();
    console.log('ZXing BrowserMultiFormatReader initialized');
    
    // Get available cameras
    getAvailableCameras();
    
    return () => {
      stopScanner();
    };
  }, []);

  // Check camera support
  useEffect(() => {
    checkCameraSupport();
  }, []);

  // Load email suggestions when component mounts
  useEffect(() => {
    loadEmailSuggestions();
  }, []);

  const getAvailableCameras = async () => {
    try {
      const videoInputDevices = await codeReaderRef.current.listVideoInputDevices();
      setAvailableCameras(videoInputDevices);
      
      // Try to find back camera
      const backCamera = videoInputDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment')
      );
      
      if (backCamera) {
        setSelectedCameraId(backCamera.deviceId);
      } else if (videoInputDevices.length > 0) {
        setSelectedCameraId(videoInputDevices[0].deviceId);
      }
      
      setScanDebug(`Found ${videoInputDevices.length} cameras`);
    } catch (error) {
      console.error('Error getting cameras:', error);
      setScanDebug('Could not access camera list');
    }
  };

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

      // Wait a bit for the video element to be available in DOM
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!videoRef.current) {
        throw new Error('Video element not found. Please try again.');
      }

      // Request camera stream first
      const constraints = {
        video: { 
          deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: selectedCameraId ? undefined : 'environment'
        } 
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Set stream to video element
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS
      
      // Wait for video to be ready
      await new Promise((resolve, reject) => {
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => resolve();
          videoRef.current.onerror = reject;
        } else {
          reject(new Error('Video element not available'));
        }
      });

      await videoRef.current.play();
      
      streamRef.current = stream;

      // Start ZXing decoding
      codeReaderRef.current.decodeFromVideoDevice(
        selectedCameraId,
        videoRef.current,
        (result, error) => {
          if (result) {
            handleScanResult(result.getText());
          }
          
          if (error && !(error instanceof NotFoundException)) {
            console.log('ZXing scan error:', error);
            setScanDebug(`Scanning... ${error.message || 'Looking for barcode'}`);
          }
        }
      );

      setIsScanning(true);
      setCameraPermission('granted');
      setScanDebug('Scanner started. Point camera at barcode...');
      setRetryCount(0); // Reset retry count on success

    } catch (err) {
      console.error('Scanner error:', err);
      handleCameraError(err);
      setScanDebug(`Scanner error: ${err.message}`);
      
      // Auto-retry logic (max 3 retries)
      if (retryCount < 3) {
        setRetryCount(prev => prev + 1);
        setScanDebug(`Retrying... (${retryCount + 1}/3)`);
        setTimeout(() => startScanner(), 1000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const stopScanner = async () => {
    try {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      setIsScanning(false);
      setScanDebug('Scanner stopped');
    } catch (error) {
      console.error('Error stopping scanner:', error);
    }
  };

  const switchCamera = async (cameraId) => {
    setSelectedCameraId(cameraId);
    setScanDebug(`Switching to camera: ${cameraId}`);
    
    if (isScanning) {
      await stopScanner();
      setTimeout(() => startScanner(), 500);
    }
  };

  const handleCameraError = (error) => {
    let errorMessage = 'Camera access denied or not available';
    
    switch (error.name) {
      case 'NotAllowedError':
        errorMessage = 'Camera permission denied. Please allow camera access in your browser settings.';
        setCameraPermission('denied');
        break;
      case 'NotFoundError':
        errorMessage = 'No camera found. Please check if a camera is connected.';
        break;
      case 'OverconstrainedError':
        errorMessage = 'No camera found that meets the requirements. Try switching cameras.';
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

  const handleVideoError = (e) => {
    console.error('Video error:', e);
    setCameraError('Failed to load video stream. Please try again.');
    setScanDebug('Video element error occurred');
  };

  const retryCamera = async () => {
    setCameraError('');
    setCameraPermission('prompt');
    setRetryCount(0);
    await getAvailableCameras();
    await startScanner();
  };

  const handleScanResult = (decodedText) => {
    console.log('Barcode scanned:', decodedText);
    
    // Clean and validate the scanned result
    const cleanText = decodedText.trim();
    
    // Check if it's a valid email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (emailRegex.test(cleanText)) {
      setScanResult(cleanText);
      setSuccess('Barcode scanned successfully!');
      setTimeout(() => setSuccess(''), 3000);
      checkParticipant(cleanText);
      stopScanner();
    } else {
      setError('Scanned code is not a valid email address');
      setScanDebug(`Invalid format: ${cleanText}`);
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
      const response = await axios.get(
        `${API_BASE_URL}/api/participant/${encodeURIComponent(email)}`,
        { headers: getAuthHeader() }
      );
      setParticipant(response.data);
      setError('');
      setScanDebug(`Participant found: ${response.data.name}`);
    } catch (error) {
      setParticipant(null);
      if (error.response?.status === 404) {
        setError('Participant not found in database');
      } else {
        setError('Error checking participant: ' + (error.response?.data?.message || error.message));
      }
      setScanDebug(`Error: ${error.message}`);
    }
  };

  const markMealConsumed = async (day, mealType) => {
    try {
      setIsLoading(true);
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const response = await axios.put(
        `${API_BASE_URL}/api/participant/${encodeURIComponent(scanResult)}/meal`,
        { day, mealType },
        { headers: getAuthHeader() }
      );
      setParticipant(response.data);
      setSuccess(`${mealType} marked as consumed!`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError('Error updating meal status: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsLoading(false);
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
        disabled={meal.consumed || !participant || isLoading}
        fullWidth
        sx={{ mb: 1 }}
        startIcon={isLoading ? <CircularProgress size={20} /> : null}
      >
        {meal.consumed ? `${label} ✓` : label}
      </Button>
    );
  };

  const CameraHelpDialog = () => (
    <Dialog open={showCameraHelp} onClose={() => setShowCameraHelp(false)} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center">
          <CameraAlt sx={{ mr: 1 }} />
          ZXing Barcode Scanner Help
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="h6" gutterBottom>
          Using ZXing Barcode Scanner
        </Typography>

        <List>
          <ListItem>
            <ListItemIcon>
              <Smartphone />
            </ListItemIcon>
            <ListItemText 
              primary="Supported Formats" 
              secondary="Code 128, QR Code, UPC-A, EAN-8, EAN-13, Code 39, Code 93"
            />
          </ListItem>
          
          <ListItem>
            <ListItemIcon>
              <Videocam />
            </ListItemIcon>
            <ListItemText 
              primary="Camera Access" 
              secondary="Ensure you allow camera permissions when prompted"
            />
          </ListItem>
          
          <ListItem>
            <ListItemIcon>
              <QrCodeScanner />
            </ListItemIcon>
            <ListItemText 
              primary="Good Lighting" 
              secondary="Ensure the barcode is well-lit without glare or shadows"
            />
          </ListItem>

          <ListItem>
            <ListItemIcon>
              <Refresh />
            </ListItemIcon>
            <ListItemText 
              primary="Switch Cameras" 
              secondary="Use camera dropdown to switch between front and back cameras"
            />
          </ListItem>
        </List>

        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>ZXing Library:</strong> Powerful barcode scanning library used by many production applications.
          </Typography>
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowCameraHelp(false)}>Close</Button>
        <Button onClick={startScanner} variant="contained">
          Start Scanner
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box>
      <Typography variant="h4" gutterBottom align="center">
        Barcode Scanner (ZXing)
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  Scanner Interface
                </Typography>
                {availableCameras.length > 1 && (
                  <Autocomplete
                    size="small"
                    options={availableCameras}
                    getOptionLabel={(option) => option.label || `Camera ${availableCameras.indexOf(option) + 1}`}
                    value={availableCameras.find(cam => cam.deviceId === selectedCameraId) || null}
                    onChange={(event, newValue) => {
                      if (newValue) {
                        switchCamera(newValue.deviceId);
                      }
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Camera"
                        size="small"
                        sx={{ width: 200 }}
                      />
                    )}
                  />
                )}
              </Box>

              {cameraError && (
                <Alert severity="error" sx={{ mb: 2 }}
                  action={
                    <Button 
                      size="small" 
                      onClick={retryCamera}
                      disabled={isLoading}
                    >
                      Retry
                    </Button>
                  }
                >
                  {cameraError}
                  {retryCount > 0 && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Retry attempt: {retryCount}/3
                    </Typography>
                  )}
                </Alert>
              )}

              {!isCameraSupported && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Camera not supported in this browser. Please use Chrome, Firefox, or Safari.
                </Alert>
              )}

              {cameraPermission === 'denied' && (
                <Alert severity="warning" sx={{ mb: 2 }}
                  action={
                    <Button 
                      size="small" 
                      onClick={() => setShowCameraHelp(true)}
                    >
                      Get Help
                    </Button>
                  }
                >
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

              {/* Scanner Container - Always in DOM but conditionally visible */}
              <Box sx={{ 
                mb: 2, 
                position: 'relative',
                display: isScanning ? 'block' : 'none'
              }}>
                <video
                  ref={videoRef}
                  style={{ 
                    width: '100%',
                    height: '300px',
                    border: '2px solid #1976d2',
                    borderRadius: 1,
                    backgroundColor: '#000',
                    objectFit: 'cover'
                  }}
                  playsInline
                  muted
                  onError={handleVideoError}
                  onLoadedMetadata={() => {
                    setScanDebug('Video stream loaded successfully');
                  }}
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
                <Box 
                  sx={{ 
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    fontSize: '0.75rem'
                  }}
                >
                  ZXing
                </Box>
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

                  <Button
                    variant="outlined"
                    onClick={getAvailableCameras}
                    startIcon={<Refresh />}
                    size="small"
                  >
                    Refresh Cameras
                  </Button>
                </Box>

                <Typography variant="caption" color="textSecondary" sx={{ mt: 1, display: 'block' }}>
                  {emailSuggestions.length} participants available • {availableCameras.length} cameras detected
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

              {error && (
                <Alert 
                  severity="error" 
                  sx={{ mb: 2 }}
                  action={
                    <IconButton
                      size="small"
                      onClick={() => setError('')}
                    >
                      <Close />
                    </IconButton>
                  }
                >
                  {error}
                </Alert>
              )}
              
              {success && (
                <Alert 
                  severity="success" 
                  sx={{ mb: 2 }}
                  action={
                    <IconButton
                      size="small"
                      onClick={() => setSuccess('')}
                    >
                      <Close />
                    </IconButton>
                  }
                >
                  {success}
                </Alert>
              )}

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
