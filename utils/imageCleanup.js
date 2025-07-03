// utils/imageCleanup.js
const fs = require('fs');
const path = require('path');
const { sendDiscordWebhookMessage } = require('./discord');

function clearImageFolder(imgFolder, webhookUrl) {
  fs.readdir(imgFolder, (err, files) => {
    if (err) {
      console.error("Failed to read image folder:", err);
      return;
    }
    if (files.length === 0) {
      console.log("Image folder is already empty, nothing to delete.");
      return;
    }
    console.log(`Found ${files.length} file(s) to delete.`);
    for (const file of files) {
      const filePath = path.join(imgFolder, file);
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error(`Failed to delete file ${file}:`, err);
        } else {
          console.log(`Deleted file ${file}`);
        }
      });
    }
    sendDiscordWebhookMessage(webhookUrl, `🧹 Image folder cleanup done: deleted ${files.length} file(s).`);
  });
}

module.exports = { clearImageFolder };
