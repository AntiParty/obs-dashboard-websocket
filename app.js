// app.js
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const OBSManager = require('./obs');
const apiRoutes = require('./routes/api');

const config = {
  host: process.env.OBS_HOST || 'localhost',
  port: process.env.OBS_PORT || 4455,
  password: process.env.OBS_PASSWORD || 'test123',
  serverPort: process.env.SERVER_PORT || 2000,
};
const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

const app = express();
const activeClients = new Map();
const obsConnections = new Map();
const obsManager = new OBSManager(config);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Track client activity
app.use((req, res, next) => {
  const clientId = req.ip;
  if (req.path === '/' || req.path.startsWith('/api/')) {
    activeClients.set(clientId, Date.now());
    // Cleanup logic can be added here
  }
  next();
});

// Mount API routes
app.use('/api', apiRoutes(config, discordWebhookUrl, activeClients, obsConnections, obsManager));

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;