// obs.js
const OBSWebSocket = require('obs-websocket-js').default;

class OBSManager {
  constructor(config) {
    this.config = config;
    this.obs = new OBSWebSocket();
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.MAX_CONNECTION_ATTEMPTS = 3;
    this.CONNECTION_TIMEOUT = 5000;
  }

  async connect() {
    if (this.isConnected) return true;
    try {
      const url = `ws://${this.config.host}:${this.config.port}`;
      await Promise.race([
        this.obs.connect(url, this.config.password),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), this.CONNECTION_TIMEOUT))
      ]);
      this.isConnected = true;
      this.connectionAttempts = 0;
      return true;
    } catch (error) {
      this.connectionAttempts++;
      console.error(`OBS connection attempt ${this.connectionAttempts} failed:`, error.message);
      if (this.connectionAttempts >= this.MAX_CONNECTION_ATTEMPTS) {
        console.log('Max connection attempts reached. Waiting for new requests.');
      }
      return false;
    }
  }

  async call(method, params = {}) {
    try {
      const connected = await this.connect();
      if (!connected) throw new Error('OBS not available');
      return await this.obs.call(method, params);
    } catch (error) {
      this.isConnected = false;
      throw error;
    }
  }

  disconnectIfIdle(activeClients) {
    if (activeClients.size === 0 && this.isConnected) {
      this.obs.disconnect();
      this.isConnected = false;
    }
  }

  disconnect() {
    if (this.isConnected) {
      this.obs.disconnect();
      this.isConnected = false;
    }
  }
}

module.exports = OBSManager;
