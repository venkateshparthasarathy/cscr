const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Handle preflight requests

// MongoDB Atlas connection with your credentials
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://venkateshparthasarathyv_db_user:kXVKxy1cMjZkSsdE@foodcourt.whjpv5e.mongodb.net/foodcourt?retryWrites=true&w=majority';

// FIXED: Remove deprecated options and add TLS workaround for Bun
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  // FIXED: Add TLS settings to prevent destructuring error
  tls: true,
  tlsAllowInvalidCertificates: false,
})
.then(() => {
  console.log('✅ Connected to MongoDB Atlas successfully');
  console.log('📊 Database: foodcourt');
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
  console.log('💡 Please check:');
  console.log('   1. MongoDB Atlas cluster status');
  console.log('   2. Network connectivity');
  console.log('   3. IP whitelist in MongoDB Atlas');
  process.exit(1);
});

// MongoDB connection event handlers
mongoose.connection.on('connected', () => {
  console.log('📊 Mongoose connected to MongoDB Atlas');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error: ', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Mongoose disconnected from MongoDB Atlas');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('🛑 MongoDB connection closed due to app termination');
  process.exit(0);
});

// Admin Schema
const adminSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true }
}, { timestamps: true });

const Admin = mongoose.model('Admin', adminSchema);

// Participant Schema
const participantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  meals: {
    day1: {
      morningSnack: { 
        consumed: { type: Boolean, default: false },
        timestamp: { type: Date, default: null }
      },
      lunch: { 
        consumed: { type: Boolean, default: false },
        timestamp: { type: Date, default: null }
      },
      eveningSnack: { 
        consumed: { type: Boolean, default: false },
        timestamp: { type: Date, default: null }
      },
      dinner: { 
        consumed: { type: Boolean, default: false },
        timestamp: { type: Date, default: null }
      }
    },
    day2: {
      morningSnack: { 
        consumed: { type: Boolean, default: false },
        timestamp: { type: Date, default: null }
      },
      lunch: { 
        consumed: { type: Boolean, default: false },
        timestamp: { type: Date, default: null }
      },
      eveningSnack: { 
        consumed: { type: Boolean, default: false },
        timestamp: { type: Date, default: null }
      }
    }
  }
}, { timestamps: true });

const Participant = mongoose.model('Participant', participantSchema);

// Initialize default admin
const initializeAdmin = async () => {
  try {
    const existingAdmin = await Admin.findOne({ username: 'cscr' });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('cscr123$@', 12);
      const admin = new Admin({
        username: 'cscr',
        password: hashedPassword
      });
      await admin.save();
      console.log('✅ Default admin created: cscr / cscr123$@');
    } else {
      console.log('✅ Admin user already exists');
    }
  } catch (error) {
    console.error('❌ Error initializing admin:', error.message);
  }
};

// Middleware to check admin authentication
const authenticateAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
    const [username, password] = credentials.split(':');

    if (!username || !password) {
      return res.status(401).json({ error: 'Invalid authorization header' });
    }

    const admin = await Admin.findOne({ username });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
};

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString()
  });
});

// Public routes
app.get('/api/participant/:email', async (req, res) => {
  try {
    const participant = await Participant.findOne({ email: req.params.email });
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }
    res.json(participant);
  } catch (error) {
    console.error('Error fetching participant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/participant/:email/meal', async (req, res) => {
  try {
    const { day, mealType } = req.body;
    const participant = await Participant.findOne({ email: req.params.email });
    
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    // Validate day and mealType
    const validDays = ['day1', 'day2'];
    const validMeals = {
      day1: ['morningSnack', 'lunch', 'eveningSnack', 'dinner'],
      day2: ['morningSnack', 'lunch', 'eveningSnack']
    };

    if (!validDays.includes(day) || !validMeals[day]?.includes(mealType)) {
      return res.status(400).json({ error: 'Invalid day or meal type' });
    }

    participant.meals[day][mealType] = {
      consumed: true,
      timestamp: new Date()
    };
    
    await participant.save();
    res.json(participant);
  } catch (error) {
    console.error('Error updating meal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Protected admin routes
app.get('/api/participants', authenticateAdmin, async (req, res) => {
  try {
    const participants = await Participant.find().sort({ createdAt: -1 });
    res.json(participants);
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/participant', authenticateAdmin, async (req, res) => {
  try {
    const { name, mobile, email } = req.body;

    if (!name || !mobile || !email) {
      return res.status(400).json({ error: 'Name, mobile, and email are required' });
    }

    const participant = new Participant({
      name,
      mobile,
      email,
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
    res.status(201).json(participant);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    console.error('Error creating participant:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/reset-meals', authenticateAdmin, async (req, res) => {
  try {
    const result = await Participant.updateMany({}, {
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
    
    res.json({ 
      message: 'All meals reset successfully',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error resetting meals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset individual meal
app.put('/api/participant/:email/reset-meal', authenticateAdmin, async (req, res) => {
  try {
    const { day, mealType } = req.body;
    const participant = await Participant.findOne({ email: req.params.email });
    
    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    // Validate day and mealType
    const validDays = ['day1', 'day2'];
    const validMeals = {
      day1: ['morningSnack', 'lunch', 'eveningSnack', 'dinner'],
      day2: ['morningSnack', 'lunch', 'eveningSnack']
    };

    if (!validDays.includes(day) || !validMeals[day]?.includes(mealType)) {
      return res.status(400).json({ error: 'Invalid day or meal type' });
    }

    participant.meals[day][mealType] = {
      consumed: false,
      timestamp: null
    };
    
    await participant.save();
    res.json(participant);
  } catch (error) {
    console.error('Error resetting individual meal:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin login route
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const admin = await Admin.findOne({ username });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json({ 
      message: 'Login successful',
      user: { username: admin.username }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login error' });
  }
});

// Get participant count
app.get('/api/stats', authenticateAdmin, async (req, res) => {
  try {
    const totalParticipants = await Participant.countDocuments();
    const participantsWithMeals = await Participant.aggregate([
      {
        $project: {
          totalMeals: {
            $add: [
              { $size: { $objectToArray: "$meals.day1" } },
              { $size: { $objectToArray: "$meals.day2" } }
            ]
          },
          consumedMeals: {
            $add: [
              { $size: { $filter: { input: { $objectToArray: "$meals.day1" }, as: "meal", cond: "$$meal.v.consumed" } } },
              { $size: { $filter: { input: { $objectToArray: "$meals.day2" }, as: "meal", cond: "$$meal.v.consumed" } } }
            ]
          }
        }
      }
    ]);

    res.json({
      totalParticipants,
      totalMealsConsumed: participantsWithMeals.reduce((sum, p) => sum + p.consumedMeals, 0),
      totalPossibleMeals: participantsWithMeals.reduce((sum, p) => sum + p.totalMeals, 0)
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log('🚀 Starting Food Court Management System...');
  console.log(`📍 Server running on port ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  try {
    await initializeAdmin();
    console.log('✅ Server initialization completed');
  } catch (error) {
    console.error('❌ Server initialization failed:', error);
    process.exit(1);
  }
});
