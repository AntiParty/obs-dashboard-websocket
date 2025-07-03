const app = require('./app');
const fs = require('fs');
const path = require('path');
const logDir = path.join(__dirname, 'logs');
const logFile = path.join(logDir, 'server.log');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });
function logToFile(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  logStream.write(line);
}
// Patch console.log/error to also log to file
const origLog = console.log;
const origErr = console.error;
console.log = (...args) => { origLog(...args); logToFile(args.join(' ')); };
console.error = (...args) => { origErr(...args); logToFile('[ERROR] ' + args.join(' ')); };

// Start server
const PORT = process.env.SERVER_PORT || 2000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});