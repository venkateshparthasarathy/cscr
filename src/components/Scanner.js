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
  Paper
} from '@mui/material';
import { CheckCircle, Cancel, QrCodeScanner } from '@mui/icons-material';
import axios from 'axios';

const Scanner = () => {
  const [scanResult, setScanResult] = useState('');
  const [participant, setParticipant] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setError('Camera access denied or not available');
    }
  };

  const handleBarcodeInput = (email) => {
    setScanResult(email);
    checkParticipant(email);
  };

  const checkParticipant = async (email) => {
    try {
      const response = await axios.get(`http://localhost:5000/api/participant/${email}`);
      setParticipant(response.data);
      setError('');
    } catch (error) {
      setParticipant(null);
      setError('Participant not found');
    }
  };

  const markMealConsumed = async (day, mealType) => {
    try {
      const response = await axios.put(`http://localhost:5000/api/participant/${scanResult}/meal`, {
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

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

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
              
              <Box sx={{ mb: 2 }}>
                {!stream ? (
                  <Button
                    variant="contained"
                    startIcon={<QrCodeScanner />}
                    onClick={startCamera}
                    fullWidth
                  >
                    Start Camera
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

              <Paper sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Manual Email Input (for testing):
                </Typography>
                <Button
                  variant="outlined"
                  onClick={() => handleBarcodeInput('test@example.com')}
                  sx={{ mb: 1 }}
                >
                  Test Participant
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
    </Box>
  );
};

export default Scanner;