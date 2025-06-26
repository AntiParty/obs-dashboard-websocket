const stateManager = require('./stateManager');

module.exports = {
  trackClientActivity: (req) => {
    const clientId = req.ip;
    if (req.path === "/" || req.path.startsWith("/api/")) {
      stateManager.activeClients.set(clientId, Date.now());
      stateManager.cleanupInactiveClients();
    }
  },
  handleError: (res, error, defaultMessage = "An error occurred") => {
    console.error(error);
    res.status(500).json({
      error: error.message || defaultMessage,
      details: error.details || "No additional details available"
    });
  }
};