module.exports = {
  host: process.env.OBS_HOST || "localhost",
  port: process.env.OBS_PORT || 4455,
  password: process.env.OBS_PASSWORD || "test123",
  connection: {
    maxAttempts: process.env.OBS_MAX_ATTEMPTS || 3,
    clientTimeout: process.env.CLIENT_TIMEOUT || 30000,
    connectionTimeout: process.env.CONNECTION_TIMEOUT || 5000
  }
};