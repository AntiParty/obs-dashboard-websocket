// modules/audio.js
import { STATE } from './constants.js';

export async function updateAudioMeters() {
  if (!STATE.obsConnected) return;

  try {
    const response = await fetch("/api/audio-levels");
    const levels = await response.json();

    document.querySelectorAll(".audio-meter-level").forEach((meter) => {
      const sourceName = meter.closest(".audio-source").querySelector(".audio-source-name").textContent;
      const level = levels[sourceName] || 0;
      meter.style.width = `${Math.min(100, level * 100)}%`;
      meter.style.backgroundColor = level > 0.9 ? "#dc3545" : level > 0.7 ? "#ffc107" : "#28a745";
    });
  } catch (error) {
    console.error("Error updating audio meters:", error);
  }
}

// Start audio meter updates
export function startAudioMeters() {
  return setInterval(updateAudioMeters, 100);
}