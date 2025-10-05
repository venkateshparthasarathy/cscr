import React, { useState, useRef, useEffect } from 'react';
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
  IconButton,
  Fade
} from '@mui/material';
import { 
  CheckCircle, 
  Cancel, 
  QrCodeScanner, 
  CameraAlt, 
  Videocam, 
  Smartphone, 
  Close, 
  Refresh,
  Search,
  Person,
  Email,
  Phone
} from '@mui/icons-material';
import axios from 'axios';

// Import ZXing library
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

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

  // Get auth header function
  const getAuthHeader = () => {
    const credentials = btoa('cscr:cscr123$@');
    return { Authorization: `Basic ${credentials}` };
  };

  // Load email suggestions function
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setSuccess('🎉 Barcode scanned successfully!');
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
      setSuccess(`✅ ${mealType} marked as consumed!`);
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
        sx={{ 
          mb: 1,
          py: 1.5,
          borderRadius: 2,
          fontSize: '1rem',
          fontWeight: 600,
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: meal.consumed ? 'none' : 'translateY(-2px)',
            boxShadow: meal.consumed ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.2)',
          },
        }}
        startIcon={isLoading ? <CircularProgress size={20} /> : null}
      >
        {meal.consumed ? `✅ ${label}` : label}
      </Button>
    );
  };

  const CameraHelpDialog = () => (
    <Dialog 
      open={showCameraHelp} 
      onClose={() => setShowCameraHelp(false)} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" sx={{ color: '#2563eb' }}>
          <CameraAlt sx={{ mr: 1 }} />
          <Typography variant="h5" fontWeight="600">
            ZXing Barcode Scanner Help
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="h6" gutterBottom sx={{ color: '#374151', mt: 1 }}>
          Using ZXing Barcode Scanner
        </Typography>

        <List>
          <ListItem sx={{ px: 0 }}>
            <ListItemIcon>
              <Smartphone sx={{ color: '#2563eb' }} />
            </ListItemIcon>
            <ListItemText 
              primary="Supported Formats" 
              secondary="Code 128, QR Code, UPC-A, EAN-8, EAN-13, Code 39, Code 93"
              primaryTypographyProps={{ fontWeight: 600 }}
            />
          </ListItem>
          
          <ListItem sx={{ px: 0 }}>
            <ListItemIcon>
              <Videocam sx={{ color: '#2563eb' }} />
            </ListItemIcon>
            <ListItemText 
              primary="Camera Access" 
              secondary="Ensure you allow camera permissions when prompted"
              primaryTypographyProps={{ fontWeight: 600 }}
            />
          </ListItem>
          
          <ListItem sx={{ px: 0 }}>
            <ListItemIcon>
              <QrCodeScanner sx={{ color: '#2563eb' }} />
            </ListItemIcon>
            <ListItemText 
              primary="Good Lighting" 
              secondary="Ensure the barcode is well-lit without glare or shadows"
              primaryTypographyProps={{ fontWeight: 600 }}
            />
          </ListItem>

          <ListItem sx={{ px: 0 }}>
            <ListItemIcon>
              <Refresh sx={{ color: '#2563eb' }} />
            </ListItemIcon>
            <ListItemText 
              primary="Switch Cameras" 
              secondary="Use camera dropdown to switch between front and back cameras"
              primaryTypographyProps={{ fontWeight: 600 }}
            />
          </ListItem>
        </List>

        <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
          <Typography variant="body2">
            <strong>ZXing Library:</strong> Powerful barcode scanning library used by many production applications.
          </Typography>
        </Alert>
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Button 
          onClick={() => setShowCameraHelp(false)}
          sx={{ borderRadius: 2 }}
        >
          Close
        </Button>
        <Button 
          onClick={startScanner} 
          variant="contained"
          sx={{ borderRadius: 2 }}
        >
          Start Scanner
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12} lg={6}>
          <Card
            sx={{
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
              overflow: 'hidden',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              {/* Enhanced Scanner Header */}
              <Box 
                sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  mb: 3,
                  pb: 2,
                  borderBottom: '2px solid #f1f5f9'
                }}
              >
                <Typography variant="h5" fontWeight="600" color="primary">
                  Scanner Interface
                </Typography>
              
              </Box>

              {cameraError && (
                <Alert 
                  severity="error" 
                  sx={{ 
                    mb: 2,
                    borderRadius: 2,
                    alignItems: 'center',
                  }}
                  action={
                    <Button 
                      size="small" 
                      onClick={retryCamera}
                      disabled={isLoading}
                      sx={{ fontWeight: 600 }}
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
                <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                  Camera not supported in this browser. Please use Chrome, Firefox, or Safari.
                </Alert>
              )}

              {cameraPermission === 'denied' && (
                <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}
                  action={
                    <Button 
                      size="small" 
                      onClick={() => setShowCameraHelp(true)}
                      sx={{ fontWeight: 600 }}
                    >
                      Get Help
                    </Button>
                  }
                >
                  Camera access denied. Please enable camera permissions in your browser settings.
                </Alert>
              )}
              
              {/* Camera Selection */}
              {availableCameras.length > 1 && (
                <Box sx={{ mb: 2 }}>
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
                        label="Select Camera"
                        size="small"
                        sx={{ 
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                          }
                        }}
                      />
                    )}
                  />
                </Box>
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
                    }}
                  >
                    {isLoading ? (
                      <Box display="flex" alignItems="center">
                        <CircularProgress size={20} sx={{ mr: 1, color: 'white' }} />
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
                    size="large"
                    sx={{
                      py: 1.5,
                      borderRadius: 2,
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      borderWidth: 2,
                      '&:hover': {
                        borderWidth: 2,
                        transform: 'translateY(-1px)',
                      },
                    }}
                  >
                    Stop Scanner
                  </Button>
                )}
              </Box>

              {/* Scanner Container */}
              <Box sx={{ 
                mb: 2, 
                position: 'relative',
                display: isScanning ? 'block' : 'none',
                borderRadius: 2,
                overflow: 'hidden',
                border: '2px solid #2563eb',
              }}>
                <video
                  ref={videoRef}
                  style={{ 
                    width: '100%',
                    height: '300px',
                    backgroundColor: '#000',
                    objectFit: 'cover',
                    display: 'block'
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
                    fontSize: '0.75rem',
                    fontWeight: '600',
                  }}
                >
                  ZXing
                </Box>
                <Typography 
                  variant="body2" 
                  align="center" 
                  sx={{ 
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    color: 'white',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    py: 1,
                    fontWeight: '600',
                  }}
                >
                  📷 Point camera at Code 128 barcode
                </Typography>
              </Box>

              {/* Debug Info */}
              {scanDebug && (
                <Paper sx={{ p: 2, mb: 2, backgroundColor: '#f8fafc', borderRadius: 2 }}>
                  <Typography variant="caption" color="textSecondary" fontWeight="500">
                    🔍 Debug: {scanDebug}
                  </Typography>
                </Paper>
              )}

              {/* Manual Entry with Autocomplete */}
              <Paper sx={{ 
                p: 3, 
                textAlign: 'center', 
                mt: 2,
                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                border: '1px solid #e2e8f0',
                borderRadius: 2,
              }}>
                <Typography variant="h6" gutterBottom sx={{ color: '#374151' }}>
                  <Search sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Manual Search
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Search participants by email or name
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
                          <Typography variant="body1" fontWeight="600">
                            <Person sx={{ fontSize: 16, mr: 1, verticalAlign: 'middle' }} />
                            {option.name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary" sx={{ ml: 3 }}>
                            <Email sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
                            {option.label}
                          </Typography>
                          <Typography variant="caption" color="textSecondary" sx={{ ml: 2 }}>
                            <Phone sx={{ fontSize: 12, mr: 0.5, verticalAlign: 'middle' }} />
                            {option.mobile}
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
                        placeholder="Type email or name to search..."
                        size="medium"
                        fullWidth
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                          },
                        }}
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: <Search sx={{ mr: 1, color: '#64748b' }} />,
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
                    sx={{ mb: 2 }}
                  />
                  
                  <Button
                    variant="outlined"
                    onClick={() => handleManualSubmit()}
                    disabled={!manualEmail || !manualEmail.includes('@')}
                    fullWidth
                    sx={{
                      py: 1,
                      borderRadius: 2,
                      fontWeight: '600',
                    }}
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
                    sx={{ borderRadius: 2 }}
                  >
                    Scanner Help
                  </Button>
                  
                  <Button
                    variant="outlined"
                    onClick={loadEmailSuggestions}
                    startIcon={<Refresh />}
                    size="small"
                    disabled={loadingSuggestions}
                    sx={{ borderRadius: 2 }}
                  >
                    {loadingSuggestions ? 'Loading...' : 'Refresh List'}
                  </Button>

                  <Button
                    variant="outlined"
                    onClick={getAvailableCameras}
                    startIcon={<Refresh />}
                    size="small"
                    sx={{ borderRadius: 2 }}
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
                    sx={{ fontWeight: '600' }}
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Card
            sx={{
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
              overflow: 'hidden',
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h5" gutterBottom fontWeight="600" color="primary">
                Participant Details
              </Typography>
              
              {error && (
                <Alert 
                  severity="error" 
                  sx={{ 
                    mb: 2,
                    borderRadius: 2,
                    alignItems: 'center',
                  }}
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
                  sx={{ 
                    mb: 2,
                    borderRadius: 2,
                    alignItems: 'center',
                  }}
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
                <Fade in={true} timeout={500}>
                  <Paper
                    sx={{
                      p: 3,
                      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                      border: '2px solid #bae6fd',
                      borderRadius: 2,
                    }}
                  >
                    <Typography variant="h6" gutterBottom color="primary" fontWeight="600">
                      🎯 Participant Information
                    </Typography>
                    <Box sx={{ display: 'grid', gap: 2, mb: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Person sx={{ color: '#2563eb' }} />
                        <Typography><strong>Name:</strong> {participant.name}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Phone sx={{ color: '#2563eb' }} />
                        <Typography><strong>Mobile:</strong> {participant.mobile}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Email sx={{ color: '#2563eb' }} />
                        <Typography><strong>Email:</strong> {participant.email}</Typography>
                      </Box>
                    </Box>
                    
                    {/* Enhanced Meal Sections */}
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="h6" gutterBottom sx={{ 
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}>
                        <Box 
                          component="span" 
                          sx={{ 
                            background: '#2563eb',
                            color: 'white',
                            borderRadius: '50%',
                            width: 24,
                            height: 24,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: '600'
                          }}
                        >
                          1
                        </Box>
                        Day 1 Meals
                      </Typography>
                      <Box sx={{ display: 'grid', gap: 1 }}>
                        <MealButton day="day1" mealType="morningSnack" label="☕ Morning Snack" />
                        <MealButton day="day1" mealType="lunch" label="🍽️ Lunch" />
                        <MealButton day="day1" mealType="eveningSnack" label="🍪 Evening Snack" />
                        <MealButton day="day1" mealType="dinner" label="🌙 Dinner" />
                      </Box>
                    </Box>

                    <Box>
                      <Typography variant="h6" gutterBottom sx={{ 
                        color: '#7c3aed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1
                      }}>
                        <Box 
                          component="span" 
                          sx={{ 
                            background: '#7c3aed',
                            color: 'white',
                            borderRadius: '50%',
                            width: 24,
                            height: 24,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            fontWeight: '600'
                          }}
                        >
                          2
                        </Box>
                        Day 2 Meals
                      </Typography>
                      <Box sx={{ display: 'grid', gap: 1 }}>
                        <MealButton day="day2" mealType="morningSnack" label="☕ Morning Snack" />
                        <MealButton day="day2" mealType="lunch" label="🍽️ Lunch" />
                        <MealButton day="day2" mealType="eveningSnack" label="🍪 Evening Snack" />
                      </Box>
                    </Box>

                    {/* Meal Summary */}
                    <Box sx={{ mt: 3, p: 2, background: 'white', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                      <Typography variant="subtitle2" gutterBottom fontWeight="600">
                        Meal Consumption Summary
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip 
                          label={`Day 1: ${Object.values(participant.meals.day1).filter(meal => meal.consumed).length}/4 meals`}
                          color="primary" 
                          variant="outlined"
                          sx={{ fontWeight: '600' }}
                        />
                        <Chip 
                          label={`Day 2: ${Object.values(participant.meals.day2).filter(meal => meal.consumed).length}/3 meals`}
                          color="secondary" 
                          variant="outlined"
                          sx={{ fontWeight: '600' }}
                        />
                      </Box>
                    </Box>
                  </Paper>
                </Fade>
              ) : (
                <Paper
                  sx={{
                    p: 4,
                    textAlign: 'center',
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    border: '2px dashed #cbd5e1',
                    borderRadius: 2,
                  }}
                >
                  <QrCodeScanner sx={{ fontSize: 48, color: '#94a3b8', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No Participant Selected
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Scan a barcode or search for a participant to view details
                  </Typography>
                </Paper>
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
