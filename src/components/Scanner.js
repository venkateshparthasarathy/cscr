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
  Menu,
  MenuItem,
  IconButton
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
  CameraFront,
  CameraRear,
  MoreVert
} from '@mui/icons-material';
import axios from 'axios';

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
  const [scanner, setScanner] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [scanDebug, setScanDebug] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [availableCameras, setAvailableCameras] = useState([]);
  const [activeCameraId, setActiveCameraId] = useState('');
  const [cameraMenuAnchor, setCameraMenuAnchor] = useState(null);

  // Check camera support
  useEffect(() => {
    checkCameraSupport();
  }, []);

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

  const getAvailableCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setAvailableCameras(videoDevices);
      
      // Try to identify back camera (usually has "back" or "rear" in label)
      const backCamera = videoDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment')
      );
      
      const frontCamera = videoDevices.find(device => 
        device.label.toLowerCase().includes('front') || 
        device.label.toLowerCase().includes('user')
      );

      // Prefer back camera for barcode scanning
      if (backCamera) {
        setActiveCameraId(backCamera.deviceId);
        return backCamera.deviceId;
      } else if (frontCamera) {
        setActiveCameraId(frontCamera.deviceId);
        return frontCamera.deviceId;
      } else if (videoDevices.length > 0) {
        setActiveCameraId(videoDevices[0].deviceId);
        return videoDevices[0].deviceId;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting cameras:', error);
      return null;
    }
  };

  const startScanner = async (cameraId = null) => {
    setIsLoading(true);
    setCameraError('');
    setError('');
    setScanResult('');
    setScanDebug('Starting scanner...');

    try {
      // Check if html5-qrcode is available
      if (!window.Html5QrcodeScanner) {
        setCameraError('Barcode scanner library not loaded. Please refresh the page.');
        setIsLoading(false);
        return;
      }

      // Get available cameras
      const cameras = await getAvailableCameras();
      let targetCameraId = cameraId || activeCameraId;

      // If no specific camera requested, use preferred camera
      if (!targetCameraId && cameras) {
        targetCameraId = cameras;
      }

      // Stop any existing scanner
      if (scanner) {
        await scanner.clear();
        setScanner(null);
      }

      // Scanner configuration
      const config = {
        fps: 10,
        qrbox: { width: 300, height: 200 },
        rememberLastUsedCamera: true,
        supportedScanTypes: [
          window.Html5QrcodeScanType.SCAN_TYPE_QR_CODE,
          window.Html5QrcodeScanType.SCAN_TYPE_CODE_128,
          window.Html5QrcodeScanType.SCAN_TYPE_CODE_39,
          window.Html5QrcodeScanType.SCAN_TYPE_CODE_93,
          window.Html5QrcodeScanType.SCAN_TYPE_EAN_8,
          window.Html5QrcodeScanType.SCAN_TYPE_EAN_13
        ]
      };

      // Create scanner with specific camera if provided
      const html5QrcodeScanner = new window.Html5QrcodeScanner(
        "reader",
        config,
        false
      );

      setScanner(html5QrcodeScanner);
      setIsScanning(true);

      // Get camera info for debug
      const cameraInfo = availableCameras.find(cam => cam.deviceId === targetCameraId);
      setScanDebug(`Starting scanner with camera: ${cameraInfo?.label || 'Default'}`);

      // Start scanning with specific camera
      html5QrcodeScanner.render(
        (decodedText, decodedResult) => {
          setScanDebug(`Scanned: ${decodedText} (Format: ${decodedResult?.result?.format?.formatName})`);
          handleScanResult(decodedText);
        },
        (errorMessage) => {
          console.log('Scan error (continuing):', errorMessage);
        },
        {
          videoConstraints: targetCameraId ? { deviceId: { exact: targetCameraId } } : undefined
        }
      );

      setCameraPermission('granted');
    } catch (err) {
      console.error('Scanner error:', err);
      handleCameraError(err);
      setScanDebug(`Scanner error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const switchCamera = async (cameraId) => {
    setScanDebug(`Switching to camera: ${cameraId}`);
    setCameraMenuAnchor(null);
    
    // Stop current scanner
    if (scanner) {
      await scanner.clear();
      setScanner(null);
    }
    
    setIsScanning(false);
    
    // Start new scanner with selected camera
    setTimeout(() => {
      startScanner(cameraId);
    }, 500);
  };

  const stopScanner = async () => {
    try {
      if (scanner) {
        await scanner.clear();
        setScanner(null);
      }
      setIsScanning(false);
      setScanDebug('Scanner stopped');
      setCameraMenuAnchor(null);
    } catch (error) {
      console.error('Error stopping scanner:', error);
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
    
    // Validate if it looks like an email
    if (decodedText.includes('@') && decodedText.includes('.')) {
      setScanResult(decodedText);
      setSuccess('Barcode scanned successfully!');
      setTimeout(() => setSuccess(''), 3000);
      checkParticipant(decodedText);
    } else {
      setError('Scanned code does not appear to be a valid email address');
      setScanDebug(`Invalid format: ${decodedText}`);
    }
  };

  const handleManualSubmit = () => {
    if (manualEmail && manualEmail.includes('@')) {
      setScanResult(manualEmail);
      checkParticipant(manualEmail);
      setManualEmail('');
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

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (scanner) {
        try {
          scanner.clear();
        } catch (error) {
          console.error('Error cleaning up scanner:', error);
        }
      }
    };
  }, [scanner]);

  const CameraMenu = () => (
    <Menu
      anchorEl={cameraMenuAnchor}
      open={Boolean(cameraMenuAnchor)}
      onClose={() => setCameraMenuAnchor(null)}
    >
      <MenuItem disabled>
        <Typography variant="subtitle2">Select Camera:</Typography>
      </MenuItem>
      {availableCameras.map((camera) => (
        <MenuItem
          key={camera.deviceId}
          onClick={() => switchCamera(camera.deviceId)}
          selected={activeCameraId === camera.deviceId}
        >
          <ListItemIcon>
            {camera.label.toLowerCase().includes('back') || 
             camera.label.toLowerCase().includes('rear') ? (
              <CameraRear />
            ) : (
              <CameraFront />
            )}
          </ListItemIcon>
          <ListItemText 
            primary={camera.label || `Camera ${availableCameras.indexOf(camera) + 1}`}
            secondary={activeCameraId === camera.deviceId ? 'Active' : ''}
          />
        </MenuItem>
      ))}
      {availableCameras.length === 0 && (
        <MenuItem disabled>
          <Typography variant="body2">No cameras found</Typography>
        </MenuItem>
      )}
    </Menu>
  );

  const CameraHelpDialog = () => (
    <Dialog open={showCameraHelp} onClose={() => setShowCameraHelp(false)} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center">
          <CameraAlt sx={{ mr: 1 }} />
          Camera Switching Help
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="h6" gutterBottom>
          How to Switch Cameras
        </Typography>
        
        <List>
          <ListItem>
            <ListItemIcon>
              <CameraRear />
            </ListItemIcon>
            <ListItemText 
              primary="Back Camera (Recommended)" 
              secondary="Better for barcode scanning. Higher quality, auto-focus"
            />
          </ListItem>
          
          <ListItem>
            <ListItemIcon>
              <CameraFront />
            </ListItemIcon>
            <ListItemText 
              primary="Front Camera" 
              secondary="Use if back camera has issues or for selfie mode"
            />
          </ListItem>
          
          <ListItem>
            <ListItemIcon>
              <Refresh />
            </ListItemIcon>
            <ListItemText 
              primary="Switch Anytime" 
              secondary="Click camera icon during scanning to switch cameras"
            />
          </ListItem>
        </List>

        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>Tip:</strong> The app automatically tries to use the back camera first for better barcode scanning quality.
          </Typography>
        </Alert>

        <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
          Troubleshooting:
        </Typography>
        <Box component="ul" sx={{ pl: 2 }}>
          <li><Typography variant="body2">If camera switch fails, stop and restart scanner</Typography></li>
          <li><Typography variant="body2">Ensure good lighting for back camera</Typography></li>
          <li><Typography variant="body2">Hold device steady 6-12 inches from barcode</Typography></li>
        </Box>
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
        Barcode Scanner
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                  Scanner Interface
                </Typography>
                {isScanning && availableCameras.length > 1 && (
                  <IconButton
                    onClick={(e) => setCameraMenuAnchor(e.currentTarget)}
                    color="primary"
                    title="Switch Camera"
                  >
                    <CameraRear />
                  </IconButton>
                )}
              </Box>

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
                  <Box 
                    id="reader"
                    sx={{ 
                      width: '100%',
                      minHeight: '300px',
                      border: '2px solid #1976d2',
                      borderRadius: 1,
                      overflow: 'hidden',
                      backgroundColor: '#000'
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
                    {availableCameras.find(cam => cam.deviceId === activeCameraId)?.label || 'Camera'}
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
              )}

              {/* Debug Info */}
              {scanDebug && (
                <Paper sx={{ p: 1, mb: 2, backgroundColor: '#f5f5f5' }}>
                  <Typography variant="caption" color="textSecondary">
                    Debug: {scanDebug}
                  </Typography>
                </Paper>
              )}

              <Paper sx={{ p: 2, textAlign: 'center', mt: 2 }}>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Manual Entry (if scanner fails):
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                  <TextField
                    size="small"
                    placeholder="Enter email manually"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    fullWidth
                  />
                  <Button
                    variant="outlined"
                    onClick={handleManualSubmit}
                  >
                    Submit
                  </Button>
                </Box>
                <Button
                  variant="outlined"
                  onClick={() => setShowCameraHelp(true)}
                  startIcon={<CameraAlt />}
                >
                  Camera Help & Tips
                </Button>
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

      <CameraMenu />
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
