import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Grid,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Autocomplete,
  Chip,
  FormControl,
  FormLabel,
  FormGroup,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import { Add, Refresh, Logout, CheckCircle, Cancel } from '@mui/icons-material';
import axios from 'axios';

const AdminPanel = ({ onLogout }) => {
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: ''
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [participants, setParticipants] = useState([]);
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [mealStatus, setMealStatus] = useState({
    day1: {
      morningSnack: false,
      lunch: false,
      eveningSnack: false,
      dinner: false
    },
    day2: {
      morningSnack: false,
      lunch: false,
      eveningSnack: false
    }
  });

  const getAuthHeader = () => {
    const credentials = btoa('cscr:cscr123$@');
    return { Authorization: `Basic ${credentials}` };
  };

  // Fetch all participants for search suggestions
  useEffect(() => {
    fetchParticipants();
  }, []);

  const fetchParticipants = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/participants', {
        headers: getAuthHeader()
      });
      setParticipants(response.data);
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  };

  // Update meal status when participant is selected
  useEffect(() => {
    if (selectedParticipant) {
      setMealStatus({
        day1: {
          morningSnack: selectedParticipant.meals.day1.morningSnack.consumed,
          lunch: selectedParticipant.meals.day1.lunch.consumed,
          eveningSnack: selectedParticipant.meals.day1.eveningSnack.consumed,
          dinner: selectedParticipant.meals.day1.dinner.consumed
        },
        day2: {
          morningSnack: selectedParticipant.meals.day2.morningSnack.consumed,
          lunch: selectedParticipant.meals.day2.lunch.consumed,
          eveningSnack: selectedParticipant.meals.day2.eveningSnack.consumed
        }
      });
    }
  }, [selectedParticipant]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const addParticipant = async () => {
    try {
      await axios.post('http://localhost:5000/api/participant', formData, {
        headers: getAuthHeader()
      });
      setMessage('Participant added successfully!');
      setError('');
      setFormData({ name: '', mobile: '', email: '' });
      fetchParticipants(); // Refresh the participants list
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setError('Error adding participant: ' + error.response?.data?.error);
      setMessage('');
    }
  };

  const resetAllMeals = async () => {
    try {
      await axios.put('http://localhost:5000/api/reset-meals', {}, {
        headers: getAuthHeader()
      });
      setMessage('All meals reset successfully!');
      setError('');
      setResetDialogOpen(false);
      fetchParticipants(); // Refresh data
      if (selectedParticipant) {
        // Refresh selected participant
        const response = await axios.get(`http://localhost:5000/api/participant/${selectedParticipant.email}`, {
          headers: getAuthHeader()
        });
        setSelectedParticipant(response.data);
      }
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setError('Error resetting meals');
      setMessage('');
    }
  };

  const handleMealStatusChange = async (day, mealType, consumed) => {
    if (!selectedParticipant) return;

    try {
      if (consumed) {
        // Mark meal as consumed
        await axios.put(`http://localhost:5000/api/participant/${selectedParticipant.email}/meal`, {
          day,
          mealType
        }, {
          headers: getAuthHeader()
        });
      } else {
        // Reset meal
        await axios.put(`http://localhost:5000/api/participant/${selectedParticipant.email}/reset-meal`, {
          day,
          mealType
        }, {
          headers: getAuthHeader()
        });
      }

      // Refresh participant data
      const response = await axios.get(`http://localhost:5000/api/participant/${selectedParticipant.email}`, {
        headers: getAuthHeader()
      });
      setSelectedParticipant(response.data);
      setMessage(`Meal status updated successfully!`);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setError('Error updating meal status');
      setMessage('');
    }
  };

  const MealCheckbox = ({ day, mealType, label }) => {
    const isConsumed = mealStatus[day][mealType];
    const timestamp = selectedParticipant?.meals[day][mealType]?.timestamp;

    return (
      <Box sx={{ mb: 1, p: 1, border: '1px solid #e0e0e0', borderRadius: 1 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={isConsumed}
              onChange={(e) => handleMealStatusChange(day, mealType, e.target.checked)}
              icon={<Cancel color="disabled" />}
              checkedIcon={<CheckCircle color="success" />}
            />
          }
          label={
            <Box>
              <Typography variant="body2" fontWeight="medium">
                {label}
              </Typography>
              {timestamp && (
                <Typography variant="caption" color="textSecondary">
                  Consumed: {new Date(timestamp).toLocaleString()}
                </Typography>
              )}
            </Box>
          }
        />
      </Box>
    );
  };

  const clearSelection = () => {
    setSelectedParticipant(null);
    setSearchInput('');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Admin Panel
        </Typography>
        <Button
          variant="outlined"
          color="secondary"
          startIcon={<Logout />}
          onClick={onLogout}
        >
          Logout
        </Button>
      </Box>

      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Add New Participant
              </Typography>

              <TextField
                fullWidth
                label="Name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                margin="normal"
              />
              <TextField
                fullWidth
                label="Mobile"
                name="mobile"
                value={formData.mobile}
                onChange={handleInputChange}
                margin="normal"
              />
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                margin="normal"
                helperText="This will be used as barcode value (Code-128)"
              />

              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={addParticipant}
                sx={{ mt: 2 }}
                fullWidth
              >
                Add Participant
              </Button>
            </CardContent>
          </Card>

          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Management
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Reset all meal consumption data for ALL participants.
              </Typography>
              <Button
                variant="outlined"
                color="warning"
                startIcon={<Refresh />}
                onClick={() => setResetDialogOpen(true)}
                fullWidth
              >
                Reset All Meals
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Search & Edit Participant Meals
              </Typography>

              <Autocomplete
                options={participants}
                getOptionLabel={(option) => `${option.name} (${option.email})`}
                inputValue={searchInput}
                onInputChange={(event, newInputValue) => {
                  setSearchInput(newInputValue);
                }}
                onChange={(event, newValue) => {
                  setSelectedParticipant(newValue);
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search participants by name or email"
                    margin="normal"
                    fullWidth
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props}>
                    <Box>
                      <Typography variant="body1">{option.name}</Typography>
                      <Typography variant="body2" color="textSecondary">
                        {option.email} • {option.mobile}
                      </Typography>
                    </Box>
                  </li>
                )}
              />

              {selectedParticipant && (
                <Paper sx={{ p: 2, mt: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        {selectedParticipant.name}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Email: {selectedParticipant.email}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        Mobile: {selectedParticipant.mobile}
                      </Typography>
                    </Box>
                    <Button 
                      size="small" 
                      onClick={clearSelection}
                      variant="outlined"
                    >
                      Clear
                    </Button>
                  </Box>

                  <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                    Day 1 Meals
                  </Typography>
                  <FormControl component="fieldset" fullWidth>
                    <MealCheckbox day="day1" mealType="morningSnack" label="Morning Snack" />
                    <MealCheckbox day="day1" mealType="lunch" label="Lunch" />
                    <MealCheckbox day="day1" mealType="eveningSnack" label="Evening Snack" />
                    <MealCheckbox day="day1" mealType="dinner" label="Dinner" />
                  </FormControl>

                  <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                    Day 2 Meals
                  </Typography>
                  <FormControl component="fieldset" fullWidth>
                    <MealCheckbox day="day2" mealType="morningSnack" label="Morning Snack" />
                    <MealCheckbox day="day2" mealType="lunch" label="Lunch" />
                    <MealCheckbox day="day2" mealType="eveningSnack" label="Evening Snack" />
                  </FormControl>

                  <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Chip 
                      label={`Day 1: ${Object.values(selectedParticipant.meals.day1).filter(meal => meal.consumed).length}/4 meals`}
                      color="primary" 
                      variant="outlined"
                    />
                    <Chip 
                      label={`Day 2: ${Object.values(selectedParticipant.meals.day2).filter(meal => meal.consumed).length}/3 meals`}
                      color="secondary" 
                      variant="outlined"
                    />
                  </Box>
                </Paper>
              )}

              {!selectedParticipant && searchInput && (
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1, textAlign: 'center' }}>
                  Start typing to search for participants...
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Reset All Meals Confirmation Dialog */}
      <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)}>
        <DialogTitle>Confirm Reset All Meals</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to reset ALL meals for ALL participants? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialogOpen(false)}>Cancel</Button>
          <Button onClick={resetAllMeals} color="warning" variant="contained">
            Reset All Meals
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminPanel;