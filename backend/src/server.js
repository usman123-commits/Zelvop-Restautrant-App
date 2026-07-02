require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const riderOrderRoutes = require('./routes/riderOrders');
const riderStatusRoutes = require('./routes/riderStatus');
const ownerOrderRoutes = require('./routes/ownerOrders');
const notificationRoutes = require('./routes/notifications');
const uploadRoutes = require('./routes/upload');

const { startScheduledJobs, checkAcceptTimeouts, checkStaleAccepted } = require('./services/scheduledJobs');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/orders', riderOrderRoutes);
app.use('/api/v1/riders', riderStatusRoutes);
app.use('/api/v1/owner', ownerOrderRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/upload', uploadRoutes);

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Dev-only: manually trigger scheduled checks
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/v1/dev/run-timeouts', async (req, res) => {
    const count = await checkAcceptTimeouts();
    res.json({ processed: count });
  });
  app.post('/api/v1/dev/run-stale-check', async (req, res) => {
    const count = await checkStaleAccepted();
    res.json({ processed: count });
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Zelvop backend running on port ${PORT}`);
    startScheduledJobs();
  });
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
