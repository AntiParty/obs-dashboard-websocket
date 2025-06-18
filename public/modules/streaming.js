// modules/streaming.js
import { DOM, STATE } from './constants.js';
import { updateStatusUI } from './ui.js';

export async function toggleStream() {
  try {
    const action = STATE.streaming ? "stop" : "start";
    const res = await fetch("/api/streaming", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    if (res.ok) {
      STATE.streaming = !STATE.streaming;
      updateStatusUI();
    }
  } catch (err) {
    console.error("Error controlling stream:", err);
  }
}

export async function toggleRecording() {
  try {
    const action = STATE.recording ? "stop" : "start";
    const res = await fetch("/api/recording", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    if (res.ok) {
      STATE.recording = !STATE.recording;
      updateStatusUI();
    }
  } catch (err) {
    console.error("Error controlling recording:", err);
  }
}