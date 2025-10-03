import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TextField,
  Button
} from '@mui/material';
import { CheckCircle, Cancel } from '@mui/icons-material';
import axios from 'axios';

const ParticipantsView = () => {
  const [participants, setParticipants] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredParticipants, setFilteredParticipants] = useState([]);

  const getAuthHeader = useCallback(() => {
    const credentials = btoa('cscr:cscr123$@');
    return { Authorization: `Basic ${credentials}` };
  }, []);

  const fetchParticipants = useCallback(async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/participants', {
        headers: getAuthHeader()
      });
      setParticipants(response.data);
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  }, [getAuthHeader]);

  const filterParticipants = useCallback(() => {
    if (!searchTerm.trim()) {
      setFilteredParticipants(participants);
      return;
    }

    const filtered = participants.filter(participant =>
      participant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participant.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      participant.mobile.includes(searchTerm)
    );
    setFilteredParticipants(filtered);
  }, [participants, searchTerm]);

  useEffect(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  useEffect(() => {
    filterParticipants();
  }, [filterParticipants]);

  const MealStatus = ({ consumed, timestamp }) => {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {consumed ? (
          <Chip
            icon={<CheckCircle />}
            label={timestamp ? new Date(timestamp).toLocaleTimeString() : 'Consumed'}
            color="success"
            size="small"
            title={timestamp ? `Consumed at: ${new Date(timestamp).toLocaleString()}` : 'Consumed'}
          />
        ) : (
          <Chip
            icon={<Cancel />}
            label="Not Consumed"
            color="default"
            size="small"
            variant="outlined"
          />
        )}
      </Box>
    );
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom align="center">
        Participants & Meal Consumption
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              fullWidth
              label="Search by Name, Email, or Mobile"
              value={searchTerm}
              onChange={handleSearch}
              margin="normal"
              placeholder="Enter name, email, or mobile number..."
            />
            <Button
              variant="outlined"
              onClick={clearSearch}
              sx={{ mt: 1 }}
            >
              Clear
            </Button>
          </Box>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            {filteredParticipants.length} participant(s) found
            {searchTerm && ` for "${searchTerm}"`}
          </Typography>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Mobile</TableCell>
              <TableCell>Email</TableCell>
              <TableCell align="center">Day 1 - Morning</TableCell>
              <TableCell align="center">Day 1 - Lunch</TableCell>
              <TableCell align="center">Day 1 - Evening</TableCell>
              <TableCell align="center">Day 1 - Dinner</TableCell>
              <TableCell align="center">Day 2 - Morning</TableCell>
              <TableCell align="center">Day 2 - Lunch</TableCell>
              <TableCell align="center">Day 2 - Evening</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredParticipants.map((participant) => (
              <TableRow key={participant._id}>
                <TableCell>{participant.name}</TableCell>
                <TableCell>{participant.mobile}</TableCell>
                <TableCell>{participant.email}</TableCell>
                <TableCell align="center">
                  <MealStatus {...participant.meals.day1.morningSnack} />
                </TableCell>
                <TableCell align="center">
                  <MealStatus {...participant.meals.day1.lunch} />
                </TableCell>
                <TableCell align="center">
                  <MealStatus {...participant.meals.day1.eveningSnack} />
                </TableCell>
                <TableCell align="center">
                  <MealStatus {...participant.meals.day1.dinner} />
                </TableCell>
                <TableCell align="center">
                  <MealStatus {...participant.meals.day2.morningSnack} />
                </TableCell>
                <TableCell align="center">
                  <MealStatus {...participant.meals.day2.lunch} />
                </TableCell>
                <TableCell align="center">
                  <MealStatus {...participant.meals.day2.eveningSnack} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {filteredParticipants.length === 0 && (
        <Typography align="center" sx={{ mt: 3 }} color="textSecondary">
          {searchTerm ? 'No participants found matching your search' : 'No participants found'}
        </Typography>
      )}
    </Box>
  );
};

export default ParticipantsView;