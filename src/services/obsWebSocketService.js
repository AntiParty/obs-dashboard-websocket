const OBSWebSocket = require('obs-websocket-js').default;
const stateManager = require('../utils/stateManager');

class OBSWebSocketService {
  constructor(config) {
    this.obs = new OBSWebSocket();
    this.config = config;
    this.initialize();
  }

  initialize() {
    stateManager.init(this.obs);
  }

  async connect() {
    if (stateManager.isConnected) return true;

    try {
      console.log("Attempting to connect to OBS...");
      const url = `ws://${this.config.host}:${this.config.port}`;

      await Promise.race([
        this.obs.connect(url, this.config.password),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Connection timeout")),
            this.config.connection.connectionTimeout
          )
        ),
      ]);

      console.log("Successfully connected to OBS");
      stateManager.setConnected(true);
      return true;
    } catch (error) {
      stateManager.incrementAttempts();
      console.error(`Connection attempt ${stateManager.connectionAttempts} failed:`, error.message);

      if (stateManager.connectionAttempts >= this.config.connection.maxAttempts) {
        console.log("Max connection attempts reached. Waiting for new requests.");
      }
      return false;
    }
  }

  async call(method, params = {}) {
    try {
      const connected = await this.connect();
      if (!connected) {
        throw new Error("OBS not available");
      }

      const result = await this.obs.call(method, params);
      return result;
    } catch (error) {
      if (!(error && error.code === 604)) {
        console.error("OBS operation failed:", error);
      }
      stateManager.setConnected(false);
      throw error;
    } finally {
      this.checkIdleAndDisconnect();
    }
  }

  checkIdleAndDisconnect() {
    stateManager.cleanupInactiveClients();

    if (stateManager.activeClients.size === 0 && stateManager.isConnected) {
      console.log("No active clients - disconnecting from OBS");
      this.obs.disconnect();
      stateManager.setConnected(false);
    }
  }

  disconnect() {
    if (stateManager.isConnected) {
      this.obs.disconnect();
      stateManager.setConnected(false);
    }
  }
}

module.exports = OBSWebSocketService;