const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  obs: require('./obs-config'),
  server: {
    port: process.env.SERVER_PORT || 2000
  }
};