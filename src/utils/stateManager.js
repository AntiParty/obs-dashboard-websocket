const state = {
  obs: null,
  activeClients: new Map(),
  isConnected: false,
  connectionAttempts: 0
};

module.exports = {
  init: (obsInstance) => {
    state.obs = obsInstance;
  },
  get isConnected() {
    return state.isConnected;
  },
  setConnected: (value) => {
    state.isConnected = value;
    if (value) state.connectionAttempts = 0;
  },
  get connectionAttempts() {
    return state.connectionAttempts;
  },
  incrementAttempts: () => {
    state.connectionAttempts++;
  },
  get activeClients() {
    return state.activeClients;
  },
  cleanupInactiveClients: () => {
    const now = Date.now();
    const config = require('../config');
    const timeout = config.obs.connection.clientTimeout;

    for (const [id, lastActive] of state.activeClients) {
      if (now - lastActive > timeout) {
        state.activeClients.delete(id);
      }
    }
  }
};