const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/foodcourt', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Admin Schema
const adminSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String
});

const Admin = mongoose.model('Admin', adminSchema);

// Participant Schema
const participantSchema = new mongoose.Schema({
  name: String,
  mobile: String,
  email: { type: String, unique: true },
  meals: {
    day1: {
      morningSnack: { consumed: Boolean, timestamp: Date },
      lunch: { consumed: Boolean, timestamp: Date },
      eveningSnack: { consumed: Boolean, timestamp: Date },
      dinner: { consumed: Boolean, timestamp: Date }
    },
    day2: {
      morningSnack: { consumed: Boolean, timestamp: Date },
      lunch: { consumed: Boolean, timestamp: Date },
      eveningSnack: { consumed: Boolean, timestamp: Date }
    }
  }
});

const Participant = mongoose.model('Participant', participantSchema);

// Initialize default admin
const initializeAdmin = async () => {
  try {
    const existingAdmin = await Admin.findOne({ username: 'cscr' });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('cscr123$@', 10);
      const admin = new Admin({
        username: 'cscr',
        password: hashedPassword
      });
      await admin.save();
      console.log('Default admin created: cscr / cscr123$@');
    }
  } catch (error) {
    console.log('Admin already exists');
  }
};

// Middleware to check admin authentication
const authenticateAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
  const [username, password] = credentials.split(':');

  try {
    const admin = await Admin.findOne({ username });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authentication error' });
  }
};

// Public routes
app.get('/api/participant/:email', async (req, res) => {
  try {
    const participant = await Participant.findOne({ email: req.params.email });
    res.json(participant);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/participant/:email/meal', async (req, res) => {
  try {
    const { day, mealType } = req.body;
    const participant = await Participant.findOne({ email: req.params.email });
    
    if (participant) {
      participant.meals[day][mealType] = {
        consumed: true,
        timestamp: new Date()
      };
      await participant.save();
      res.json(participant);
    } else {
      res.status(404).json({ error: 'Participant not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Protected admin routes
app.get('/api/participants', authenticateAdmin, async (req, res) => {
  try {
    const participants = await Participant.find();
    res.json(participants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/participant', authenticateAdmin, async (req, res) => {
  try {
    const participant = new Participant({
      ...req.body,
      meals: {
        day1: {
          morningSnack: { consumed: false, timestamp: null },
          lunch: { consumed: false, timestamp: null },
          eveningSnack: { consumed: false, timestamp: null },
          dinner: { consumed: false, timestamp: null }
        },
        day2: {
          morningSnack: { consumed: false, timestamp: null },
          lunch: { consumed: false, timestamp: null },
          eveningSnack: { consumed: false, timestamp: null }
        }
      }
    });
    await participant.save();
    res.json(participant);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/reset-meals', authenticateAdmin, async (req, res) => {
  try {
    await Participant.updateMany({}, {
      $set: {
        'meals.day1.morningSnack': { consumed: false, timestamp: null },
        'meals.day1.lunch': { consumed: false, timestamp: null },
        'meals.day1.eveningSnack': { consumed: false, timestamp: null },
        'meals.day1.dinner': { consumed: false, timestamp: null },
        'meals.day2.morningSnack': { consumed: false, timestamp: null },
        'meals.day2.lunch': { consumed: false, timestamp: null },
        'meals.day2.eveningSnack': { consumed: false, timestamp: null }
      }
    });
    res.json({ message: 'All meals reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// New route: Reset individual meal
app.put('/api/participant/:email/reset-meal', authenticateAdmin, async (req, res) => {
  try {
    const { day, mealType } = req.body;
    const participant = await Participant.findOne({ email: req.params.email });
    
    if (participant) {
      participant.meals[day][mealType] = {
        consumed: false,
        timestamp: null
      };
      await participant.save();
      res.json(participant);
    } else {
      res.status(404).json({ error: 'Participant not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin login route
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const admin = await Admin.findOne({ username });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json({ message: 'Login successful' });
  } catch (error) {
    res.status(500).json({ error: 'Login error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  await initializeAdmin();
  console.log(`Server running on port ${PORT}`);
});