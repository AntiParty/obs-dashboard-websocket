// modules/connection.js
import { DOM, STATE } from './constants.js';
import { loadScenes, loadScenePreviews } from './scenes.js';
import { updateUI, updateScenePreview } from './ui.js';
import { showProfileModal, getActiveProfile } from './profile.js';

let checkInterval;

export async function checkOBSStatus() {
  try {
    const response = await fetch("/api/obs-status");
    const data = await response.json();

    if (response.status === 200) {
      if (data.status === "inactive") {
        if (!STATE.connectionActive) return;
        console.log("Dashboard inactive - refreshing connection");
        STATE.connectionActive = false;
        DOM.statusEl.textContent = "Dashboard inactive - reconnecting...";
        DOM.statusEl.style.color = "orange";
        setTimeout(() => location.reload(), 2000);
        return;
      }

      STATE.connectionActive = true;
      updateUI(data);

      // Only load scenes if we haven't already
      if (DOM.sceneSelectEl.options.length <= 1) {
        loadScenes();
        loadScenePreviews();
      }

      // Update current preview if we have a scene selected
      if (STATE.currentScene && STATE.scenePreviews[STATE.currentScene]) {
        updateScenePreview(STATE.currentScene);
      }
    }
  } catch (error) {
    console.error("Error checking OBS status:", error);
    if (STATE.connectionActive) {
      STATE.connectionActive = false;
      showConnectionError();
    }
  }
}

function showConnectionError() {
  STATE.obsConnected = false;
  updateUI();
  DOM.statusEl.textContent = "Connection error - attempting to reconnect...";
  DOM.statusEl.style.color = "red";
}

export function startStatusChecking() {
  // Send a heartbeat every 8 seconds
  const heartbeatInterval = setInterval(() => {
    fetch("/").catch(() => console.log("Heartbeat failed"));
  }, 8000);

  // Check OBS status every 2 seconds
  checkInterval = setInterval(checkOBSStatus, 2000);
  checkOBSStatus(); // Initial check

  // Cleanup function
  return () => {
    clearInterval(heartbeatInterval);
    clearInterval(checkInterval);
  };
}

// On first load, require profile selection
if (!getActiveProfile()) {
  showProfileModal(() => location.reload());
} else {
  // Optionally, send profile to backend
  const profile = getActiveProfile();
  fetch('/api/save-obs-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip: profile.ip, port: profile.port, password: profile.password })
  });
}