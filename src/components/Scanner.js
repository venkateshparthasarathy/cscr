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
  ListItemText
} from '@mui/material';
import { CheckCircle, Cancel, QrCodeScanner, CameraAlt, Videocam, Smartphone } from '@mui/icons-material';
import axios from 'axios';

const Scanner = () => {
  const [scanResult, setScanResult] = useState('');
  const [participant, setParticipant] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [isCameraSupported, setIsCameraSupported] = useState(true);
  const [cameraPermission, setCameraPermission] = useState('prompt'); // 'granted', 'denied', 'prompt'
  const [showCameraHelp, setShowCameraHelp] = useState(false);
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Check camera support and permissions
  useEffect(() => {
    checkCameraSupport();
  }, []);

  const checkCameraSupport = async () => {
    try {
      // Check if browser supports mediaDevices
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setIsCameraSupported(false);
        setCameraError('Camera API not supported in this browser');
        return;
      }

      // Check camera permissions
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

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  const startCamera = async () => {
    setIsLoading(true);
    setCameraError('');
    setError('');

    try {
      // Stop any existing stream first
      stopCamera();

      // Try different camera constraints
      const constraints = {
        video: {
          facingMode: 'environment', // Prefer rear camera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play().catch(e => {
          console.error('Error playing video:', e);
          setCameraError('Failed to start camera preview');
        });
      }
      
      setCameraPermission('granted');
    } catch (err) {
      console.error('Camera error:', err);
      handleCameraError(err);
    } finally {
      setIsLoading(false);
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
  };

  const handleBarcodeInput = (email) => {
    setScanResult(email);
    checkParticipant(email);
  };

  const checkParticipant = async (email) => {
    try {
      const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      const response = await axios.get(`${API_BASE_URL}/api/participant/${email}`);
      setParticipant(response.data);
      setError('');
    } catch (error) {
      setParticipant(null);
      setError('Participant not found');
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
    return () => stopCamera();
  }, [stopCamera]);

  const CameraHelpDialog = () => (
    <Dialog open={showCameraHelp} onClose={() => setShowCameraHelp(false)} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center">
          <CameraAlt sx={{ mr: 1 }} />
          Camera Help
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="h6" gutterBottom>
          Mobile Camera Not Working?
        </Typography>
        
        <List>
          <ListItem>
            <ListItemIcon>
              <Smartphone />
            </ListItemIcon>
            <ListItemText 
              primary="Use HTTPS" 
              secondary="Camera only works on HTTPS websites. Make sure you're using a secure connection."
            />
          </ListItem>
          
          <ListItem>
            <ListItemIcon>
              <Videocam />
            </ListItemIcon>
            <ListItemText 
              primary="Allow Camera Permissions" 
              secondary="When prompted, click 'Allow' to grant camera access. If blocked, check browser settings."
            />
          </ListItem>
          
          <ListItem>
            <ListItemIcon>
              <QrCodeScanner />
            </ListItemIcon>
            <ListItemText 
              primary="Use Rear Camera" 
              secondary="The app tries to use the rear camera automatically. Make sure no other app is using the camera."
            />
          </ListItem>
        </List>

        <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
          Still having issues? Try these steps:
        </Typography>
        <Box component="ol" sx={{ pl: 2 }}>
          <li><Typography variant="body2">Close other apps using camera</Typography></li>
          <li><Typography variant="body2">Restart your browser</Typography></li>
          <li><Typography variant="body2">Update your browser to latest version</Typography></li>
          <li><Typography variant="body2">Try a different browser (Chrome recommended)</Typography></li>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowCameraHelp(false)}>Close</Button>
        <Button onClick={startCamera} variant="contained">
          Try Camera Again
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
                {!stream ? (
                  <Button
                    variant="contained"
                    startIcon={<QrCodeScanner />}
                    onClick={startCamera}
                    disabled={isLoading || !isCameraSupported}
                    fullWidth
                    size="large"
                  >
                    {isLoading ? 'Starting Camera...' : 'Start Camera'}
                  </Button>
                ) : (
                  <Button
                    variant="outlined"
                    onClick={stopCamera}
                    fullWidth
                  >
                    Stop Camera
                  </Button>
                )}
              </Box>

              {/* Camera Preview */}
              {stream && (
                <Box sx={{ mb: 2, position: 'relative', backgroundColor: '#000', borderRadius: 1, overflow: 'hidden' }}>
                  <video
                    ref={videoRef}
                    style={{ 
                      width: '100%', 
                      height: '300px',
                      objectFit: 'cover'
                    }}
                    playsInline
                    muted
                  />
                  <Box 
                    sx={{ 
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '200px',
                      height: '2px',
                      backgroundColor: 'red',
                      opacity: 0.7
                    }}
                  />
                </Box>
              )}

              <Paper sx={{ p: 2, textAlign: 'center', mt: 2 }}>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Manual Email Input (for testing):
                </Typography>
                <Button
                  variant="outlined"
                  onClick={() => handleBarcodeInput('venky@gmail.com')}
                  sx={{ mb: 1, mr: 1 }}
                >
                  Test Participant
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setShowCameraHelp(true)}
                >
                  Camera Help
                </Button>
              </Paper>

              {scanResult && (
                <Box sx={{ mt: 2 }}>
                  <Chip 
                    label={`Scanned: ${scanResult}`}
                    color={participant ? "success" : "error"}
                    icon={participant ? <CheckCircle /> : <Cancel />}
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
    </Box>
  );
};

export default Scanner;
