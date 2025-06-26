const express = require('express');
const path = require('path');
const config = require('./config');
const OBSWebSocketService = require('./services/obsWebSocketService');
const clientTracker = require('./middlewares/clientTracker');

class App {
  constructor() {
    this.app = express();
    this.obsService = new OBSWebSocketService(config.obs);
    this.setupStaticFiles();  // Setup static files first
    this.setupMiddlewares();
    this.setupRoutes();
  }

  setupStaticFiles() {
    // Serve static files from public directory
    this.app.use(express.static(path.join(__dirname, '../public')));
    
    // Specific route handlers for HTML files
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public', 'index.html'));
    });
    
    this.app.get('/studio', (req, res) => {
      res.sendFile(path.join(__dirname, '../public', 'studio.html'));
    });
  }

  setupMiddlewares() {
    this.app.use(express.json());
    this.app.use(clientTracker);
  }

  setupRoutes() {
    const router = require('./routes');
    this.app.use('/api', router(this.obsService));
  }

  start() {
    this.server = this.app.listen(config.server.port, () => {
      console.log(`Server running at http://localhost:${config.server.port}`);
    });

    process.on('SIGINT', () => {
      this.obsService.disconnect();
      this.server.close();
      process.exit();
    });
  }
}

module.exports = App;