const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const os = require('os');
require('dotenv').config();

const app = express();

// Enhanced CORS configuration for mobile devices
app.use(cors({
  origin: '*', // Allow all origins for mobile testing
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// Handle preflight requests explicitly for mobile
app.options('*', cors());

app.use(express.json());

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
    return res.status(401).json({ 
      error: 'Authentication required',
      mobileFriendly: true 
    });
  }

  try {
    const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
    const [username, password] = credentials.split(':');

    if (!username || !password) {
      return res.status(401).json({ 
        error: 'Invalid authorization header',
        mobileFriendly: true 
      });
    }

    const admin = await Admin.findOne({ username });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        mobileFriendly: true 
      });
    }
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ 
      error: 'Authentication error',
      mobileFriendly: true 
    });
  }
};

// ==================== MOBILE-OPTIMIZED ROUTES ====================

// Health check route with mobile info
app.get('/api/health', (req, res) => {
  const networkInterfaces = os.networkInterfaces();
  const ipAddresses = [];
  
  Object.keys(networkInterfaces).forEach(interfaceName => {
    networkInterfaces[interfaceName].forEach(interface => {
      if (interface.family === 'IPv4' && !interface.internal) {
        ipAddresses.push(interface.address);
      }
    });
  });
  
  res.json({ 
    status: 'OK', 
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString(),
    mobileAccess: true,
    serverIPs: ipAddresses,
    port: process.env.PORT || 5000
  });
});

// Mobile connectivity check endpoint
app.get('/api/mobile-check', (req, res) => {
  res.json({ 
    status: 'OK',
    mobileSupport: true,
    server: 'Food Court Management System',
    timestamp: new Date().toISOString(),
    message: 'Server is ready for mobile connections'
  });
});

// Mobile-optimized participant check
app.get('/api/mobile/participant/:email', async (req, res) => {
  try {
    const participant = await Participant.findOne({ email: req.params.email });
    if (!participant) {
      return res.status(404).json({ 
        error: 'Participant not found',
        mobileFriendly: true,
        code: 'PARTICIPANT_NOT_FOUND'
      });
    }
    
    // Return only essential data for mobile
    res.json({
      name: participant.name,
      email: participant.email,
      mobile: participant.mobile,
      meals: participant.meals,
      mobileOptimized: true,
      status: 'success'
    });
  } catch (error) {
    console.error('Mobile participant fetch error:', error);
    res.status(500).json({ 
      error: 'Unable to fetch participant data',
      mobileFriendly: true,
      code: 'FETCH_ERROR'
    });
  }
});

// Mobile-optimized meal update
app.put('/api/mobile/participant/:email/meal', async (req, res) => {
  try {
    const { day, mealType } = req.body;
    const participant = await Participant.findOne({ email: req.params.email });
    
    if (!participant) {
      return res.status(404).json({ 
        error: 'Participant not found',
        mobileFriendly: true 
      });
    }

    // Validate day and mealType
    const validDays = ['day1', 'day2'];
    const validMeals = {
      day1: ['morningSnack', 'lunch', 'eveningSnack', 'dinner'],
      day2: ['morningSnack', 'lunch', 'eveningSnack']
    };

    if (!validDays.includes(day) || !validMeals[day]?.includes(mealType)) {
      return res.status(400).json({ 
        error: 'Invalid day or meal type',
        mobileFriendly: true,
        validDays,
        validMeals
      });
    }

    participant.meals[day][mealType] = {
      consumed: true,
      timestamp: new Date()
    };
    
    await participant.save();
    
    res.json({
      status: 'success',
      message: 'Meal updated successfully',
      participant: {
        name: participant.name,
        email: participant.email,
        meals: participant.meals
      },
      mobileOptimized: true
    });
  } catch (error) {
    console.error('Mobile meal update error:', error);
    res.status(500).json({ 
      error: 'Failed to update meal',
      mobileFriendly: true 
    });
  }
});

// ==================== EXISTING ROUTES (UPDATED FOR MOBILE) ====================

// Public routes
app.get('/api/participant/:email', async (req, res) => {
  try {
    const participant = await Participant.findOne({ email: req.params.email });
    if (!participant) {
      return res.status(404).json({ 
        error: 'Participant not found',
        mobileFriendly: true 
      });
    }
    res.json(participant);
  } catch (error) {
    console.error('Error fetching participant:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      mobileFriendly: true 
    });
  }
});

app.put('/api/participant/:email/meal', async (req, res) => {
  try {
    const { day, mealType } = req.body;
    const participant = await Participant.findOne({ email: req.params.email });
    
    if (!participant) {
      return res.status(404).json({ 
        error: 'Participant not found',
        mobileFriendly: true 
      });
    }

    // Validate day and mealType
    const validDays = ['day1', 'day2'];
    const validMeals = {
      day1: ['morningSnack', 'lunch', 'eveningSnack', 'dinner'],
      day2: ['morningSnack', 'lunch', 'eveningSnack']
    };

    if (!validDays.includes(day) || !validMeals[day]?.includes(mealType)) {
      return res.status(400).json({ 
        error: 'Invalid day or meal type',
        mobileFriendly: true 
      });
    }

    participant.meals[day][mealType] = {
      consumed: true,
      timestamp: new Date()
    };
    
    await participant.save();
    res.json(participant);
  } catch (error) {
    console.error('Error updating meal:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      mobileFriendly: true 
    });
  }
});

// Protected admin routes
app.get('/api/participants', authenticateAdmin, async (req, res) => {
  try {
    const participants = await Participant.find().sort({ createdAt: -1 });
    res.json(participants);
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      mobileFriendly: true 
    });
  }
});

app.post('/api/participant', authenticateAdmin, async (req, res) => {
  try {
    const { name, mobile, email } = req.body;

    if (!name || !mobile || !email) {
      return res.status(400).json({ 
        error: 'Name, mobile, and email are required',
        mobileFriendly: true 
      });
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
      return res.status(400).json({ 
        error: 'Email already exists',
        mobileFriendly: true 
      });
    }
    console.error('Error creating participant:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      mobileFriendly: true 
    });
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
      modifiedCount: result.modifiedCount,
      mobileFriendly: true
    });
  } catch (error) {
    console.error('Error resetting meals:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      mobileFriendly: true 
    });
  }
});

// Reset individual meal
app.put('/api/participant/:email/reset-meal', authenticateAdmin, async (req, res) => {
  try {
    const { day, mealType } = req.body;
    const participant = await Participant.findOne({ email: req.params.email });
    
    if (!participant) {
      return res.status(404).json({ 
        error: 'Participant not found',
        mobileFriendly: true 
      });
    }

    // Validate day and mealType
    const validDays = ['day1', 'day2'];
    const validMeals = {
      day1: ['morningSnack', 'lunch', 'eveningSnack', 'dinner'],
      day2: ['morningSnack', 'lunch', 'eveningSnack']
    };

    if (!validDays.includes(day) || !validMeals[day]?.includes(mealType)) {
      return res.status(400).json({ 
        error: 'Invalid day or meal type',
        mobileFriendly: true 
      });
    }

    participant.meals[day][mealType] = {
      consumed: false,
      timestamp: null
    };
    
    await participant.save();
    res.json(participant);
  } catch (error) {
    console.error('Error resetting individual meal:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      mobileFriendly: true 
    });
  }
});

// Admin login route
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ 
      error: 'Username and password are required',
      mobileFriendly: true 
    });
  }

  try {
    const admin = await Admin.findOne({ username });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ 
        error: 'Invalid credentials',
        mobileFriendly: true 
      });
    }
    res.json({ 
      message: 'Login successful',
      user: { username: admin.username },
      mobileFriendly: true
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Login error',
      mobileFriendly: true 
    });
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
      totalPossibleMeals: participantsWithMeals.reduce((sum, p) => sum + p.totalMeals, 0),
      mobileFriendly: true
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      mobileFriendly: true 
    });
  }
});

// Mobile network info endpoint
app.get('/api/network-info', (req, res) => {
  const networkInterfaces = os.networkInterfaces();
  const ipAddresses = [];
  
  Object.keys(networkInterfaces).forEach(interfaceName => {
    networkInterfaces[interfaceName].forEach(interface => {
      if (interface.family === 'IPv4' && !interface.internal) {
        ipAddresses.push({
          interface: interfaceName,
          address: interface.address,
          mac: interface.mac,
          cidr: interface.cidr
        });
      }
    });
  });
  
  res.json({
    hostname: os.hostname(),
    platform: os.platform(),
    networkInterfaces: ipAddresses,
    port: process.env.PORT || 5000,
    mobileAccessURLs: ipAddresses.map(ip => `http://${ip.address}:${process.env.PORT || 5000}`),
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware with mobile support
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Something went wrong!',
    mobileFriendly: true,
    code: 'INTERNAL_SERVER_ERROR'
  });
});

// 404 handler with mobile support
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    mobileFriendly: true,
    code: 'ROUTE_NOT_FOUND',
    availableEndpoints: [
      '/api/health',
      '/api/mobile-check',
      '/api/network-info',
      '/api/participant/:email',
      '/api/mobile/participant/:email',
      '/api/admin/login'
    ]
  });
});

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, async () => {
  console.log('🚀 Starting Food Court Management System...');
  console.log(`📍 Server running on http://${HOST}:${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📱 Mobile Access: Enabled`);
  
  // Display network info for mobile testing
  const networkInterfaces = os.networkInterfaces();
  console.log('\n📡 Network Interfaces for Mobile Access:');
  
  Object.keys(networkInterfaces).forEach(interfaceName => {
    networkInterfaces[interfaceName].forEach(interface => {
      if (interface.family === 'IPv4' && !interface.internal) {
        console.log(`   ${interfaceName}: http://${interface.address}:${PORT}`);
      }
    });
  });
  
  console.log('\n🔧 Test URLs:');
  console.log(`   Health Check: http://localhost:${PORT}/api/health`);
  console.log(`   Mobile Check: http://localhost:${PORT}/api/mobile-check`);
  console.log(`   Network Info: http://localhost:${PORT}/api/network-info`);
  
  try {
    await initializeAdmin();
    console.log('\n✅ Server initialization completed');
    console.log('📱 Server is ready for mobile connections!');
  } catch (error) {
    console.error('❌ Server initialization failed:', error);
    process.exit(1);
  }
});
