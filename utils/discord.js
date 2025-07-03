// utils/discord.js
const axios = require('axios');

async function sendDiscordWebhookMessage(webhookUrl, message) {
  if (!webhookUrl) return;
  try {
    await axios.post(webhookUrl, { content: message });
  } catch (error) {
    console.error("Failed to send Discord webhook message:", error.message);
  }
}

module.exports = { sendDiscordWebhookMessage };