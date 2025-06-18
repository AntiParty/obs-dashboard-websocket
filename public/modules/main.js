// main.js
import { DOM, STATE } from './constants.js';
import { startStatusChecking } from './connection.js';
import { updateStatusUI } from './ui.js';
import { switchScene, selectScene } from './scenes.js';
import { toggleStream, toggleRecording } from './/streaming.js';

function setupEventListeners() {
  DOM.sceneSelectEl.addEventListener("change", () => {
    if (DOM.sceneSelectEl.value) {
      selectScene(DOM.sceneSelectEl.value);
    }
  });

  DOM.switchBtnEl.addEventListener("click", switchScene);
  DOM.streamBtnEl.addEventListener("click", toggleStream);
  DOM.recordBtnEl.addEventListener("click", toggleRecording);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (window.statusCleanup) window.statusCleanup();
    } else {
      window.statusCleanup = startStatusChecking();
    }
  });
}

window.addEventListener("load", () => {
  setupEventListeners();
  window.statusCleanup = startStatusChecking();
  updateStatusUI(); // Initial UI update
});