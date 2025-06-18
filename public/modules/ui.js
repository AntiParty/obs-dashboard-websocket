// modules/ui.js
import { DOM, STATE } from './constants.js';

export function updateUI(data) {
  if (data.connected) {
    STATE.obsConnected = true;
    STATE.streaming = data.streaming || false;
    STATE.recording = data.recording || false;
    updateStatusUI();
  } else {
    STATE.obsConnected = false;
    updateStatusUI();
  }
}

export function updateStatusUI() {
  if (STATE.obsConnected) {
    DOM.obsStatusEl.className = "status-indicator status-connected";
    DOM.obsStatusTextEl.textContent = "Connected to OBS";
    DOM.switchBtnEl.disabled = false;
    DOM.streamBtnEl.disabled = false;
    DOM.recordBtnEl.disabled = false;

    if (STATE.streaming) {
      DOM.streamBtnEl.innerHTML = '<i class="bi bi-broadcast"></i> Stop Stream';
      DOM.streamBtnEl.classList.remove("btn-warning");
      DOM.streamBtnEl.classList.add("btn-success");
    } else {
      DOM.streamBtnEl.innerHTML = '<i class="bi bi-broadcast"></i> Start Stream';
      DOM.streamBtnEl.classList.remove("btn-success");
      DOM.streamBtnEl.classList.add("btn-warning");
    }

    if (STATE.recording) {
      DOM.recordBtnEl.innerHTML = '<i class="bi bi-record-circle"></i> Stop Recording';
      DOM.recordBtnEl.classList.remove("btn-danger");
      DOM.recordBtnEl.classList.add("btn-secondary");
    } else {
      DOM.recordBtnEl.innerHTML = '<i class="bi bi-record-circle"></i> Start Recording';
      DOM.recordBtnEl.classList.remove("btn-secondary");
      DOM.recordBtnEl.classList.add("btn-danger");
    }
  } else {
    DOM.obsStatusEl.className = "status-indicator status-disconnected";
    DOM.obsStatusTextEl.textContent = "Disconnected from OBS";
    DOM.switchBtnEl.disabled = true;
    DOM.streamBtnEl.disabled = true;
    DOM.recordBtnEl.disabled = true;
  }
}

export function updateScenePreview(sceneName) {
  if (STATE.scenePreviews[sceneName]) {
    const imgSrc = STATE.scenePreviews[sceneName].startsWith("data:image")
      ? STATE.scenePreviews[sceneName]
      : `data:image/png;base64,${STATE.scenePreviews[sceneName]}`;

    DOM.currentPreviewEl.src = imgSrc;
    DOM.currentPreviewLabelEl.textContent = sceneName;
    DOM.currentPreviewEl.style.display = "block";
  } else {
    DOM.currentPreviewEl.style.display = "none";
    DOM.currentPreviewLabelEl.textContent = sceneName || "No scene selected";
  }

  // Update active state in preview cards
  document.querySelectorAll(".scene-preview-card").forEach((card) => {
    if (card.dataset.sceneName === sceneName) {
      card.classList.add("active");
    } else {
      card.classList.remove("active");
    }
  });
}

export function getPlaceholderImage(sceneName) {
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 180;
  const ctx = canvas.getContext("2d");

  let hash = 0;
  for (let i = 0; i < sceneName.length; i++) {
    hash = sceneName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  ctx.fillStyle = `hsl(${hue}, 70%, 30%)`;
  ctx.fillRect(0, 0, 320, 180);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "center";
  ctx.fillText(sceneName, 160, 90);

  return canvas.toDataURL();
}