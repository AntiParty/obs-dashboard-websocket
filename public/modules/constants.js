// modules/constants.js
export const DOM = {
  obsStatusEl: document.getElementById("obsStatus"),
  obsStatusTextEl: document.getElementById("obsStatusText"),
  sceneSelectEl: document.getElementById("sceneSelect"),
  switchBtnEl: document.getElementById("switchBtn"),
  statusEl: document.getElementById("status"),
  sourcesContainerEl: document.getElementById("sourcesContainer"),
  streamBtnEl: document.getElementById("streamBtn"),
  recordBtnEl: document.getElementById("recordBtn"),
  currentPreviewEl: document.getElementById("currentPreview"),
  currentPreviewLabelEl: document.getElementById("currentPreviewLabel"),
  scenePreviewsEl: document.getElementById("scenePreviews")
};

export const STATE = {
  currentScene: null,
  obsConnected: false,
  streaming: false,
  recording: false,
  connectionActive: false,
  scenePreviews: {}
};