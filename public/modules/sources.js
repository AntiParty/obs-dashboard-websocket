// modules/sources.js
import { DOM } from './constants.js';

export function renderSources(sources, sceneName) {
  // Render audio sources in the audio mixer
  const audioMixerEl = document.getElementById("audioMixer");
  audioMixerEl.innerHTML = "";
  
  // Render non-audio sources in the source list
  const sourceListEl = document.getElementById("sourcesContainer");
  sourceListEl.innerHTML = `<h5 class="mb-3">${sceneName}</h5><div id="sourceList"></div>`;
  
  const actualSourceListEl = document.getElementById("sourceList");

  // Render audio sources first
  sources.filter(source => source.isAudio).forEach(source => {
    renderAudioSource(source, audioMixerEl, sceneName);
  });

  // Render non-audio sources
  sources.filter(source => !source.isAudio).forEach(source => {
    if (source.items) renderGroup(source, sceneName, actualSourceListEl);
    else renderSource(source, sceneName, actualSourceListEl);
  });
}

function renderAudioSource(source, container, sceneName) {
  const audioSourceEl = document.createElement("div");
  audioSourceEl.className = "audio-source";

  audioSourceEl.innerHTML = `
    <div class="audio-source-info">
      <div class="audio-source-name">${source.name}</div>
      <div class="audio-source-type small text-muted">${source.type}</div>
    </div>
    <div class="audio-controls">
      <button class="btn btn-sm mute-btn ${source.muted ? "btn-danger" : "btn-outline-secondary"}" 
              data-id="${source.id}" data-source="${source.name}">
        <i class="bi ${source.muted ? "bi-volume-mute-fill" : "bi-volume-up-fill"}"></i>
      </button>
      <input type="range" class="form-range volume-slider" min="0" max="2" step="0.01" 
             value="${source.volume || 1}" 
             data-id="${source.id}" data-source="${source.name}">
      <span class="volume-value small">${Math.round((source.volume || 1) * 100)}%</span>
      <div class="audio-meter">
        <div class="audio-meter-level" style="width: 0%"></div>
      </div>
    </div>
  `;

  // Add event listeners
  const muteBtn = audioSourceEl.querySelector(".mute-btn");
  const volumeSlider = audioSourceEl.querySelector(".volume-slider");
  const volumeValue = audioSourceEl.querySelector(".volume-value");

  muteBtn.addEventListener("click", () => toggleSourceMute(sceneName, source.id, source.name, !source.muted));
  volumeSlider.addEventListener("input", (e) => {
    volumeValue.textContent = `${Math.round(e.target.value * 100)}%`;
  });
  volumeSlider.addEventListener("change", (e) => {
    setSourceVolume(sceneName, source.id, source.name, parseFloat(e.target.value));
  });

  container.appendChild(audioSourceEl);
}

function renderGroup(group, sceneName, container) {
  const groupEl = document.createElement("div");
  groupEl.className = "group-container";

  groupEl.innerHTML = `
    <div class="group-header">
      <div class="source-info">
        <strong>${group.name}</strong>
        <div class="text-muted small">Group</div>
      </div>
      <div class="form-check form-switch">
        <input class="form-check-input group-toggle" type="checkbox" 
               data-source="${group.name}" 
               data-id="${group.id}"
               ${group.visible ? "checked" : ""}>
      </div>
    </div>
    <div class="group-items" id="group-${group.id}"></div>
  `;

  // Add group items
  const groupItemsEl = groupEl.querySelector(`#group-${group.id}`);
  group.items.forEach((item) => {
    renderSource(item, sceneName, groupItemsEl, true, group.name);
  });

  // Add event listener for group toggle
  groupEl.querySelector(".group-toggle").addEventListener("change", (e) => {
    toggleSourceVisibility(
      sceneName,
      e.target.dataset.id,
      e.target.dataset.source,
      e.target.checked
    );
  });

  container.appendChild(groupEl);
}

function renderSource(source, sceneName, container, isGroupItem = false, parentGroup = null) {
  const sourceEl = document.createElement("div");
  sourceEl.className = isGroupItem ? "group-item" : "source-item";

  let audioControls = "";
  if (source.type.includes("AUDIO") || source.type === "wasapi_input_capture" || source.type === "wasapi_output_capture") {
    audioControls = `
      <div class="audio-controls">
        <button class="btn btn-sm mute-btn ${
          source.muted ? "btn-danger" : "btn-outline-secondary"
        }" 
                data-id="${source.id}" data-source="${source.name}">
          <i class="bi ${
            source.muted ? "bi-volume-mute-fill" : "bi-volume-up-fill"
          }"></i>
        </button>
        <input type="range" class="form-range volume-slider" min="0" max="1" step="0.01" 
               value="${source.volume !== undefined ? source.volume : 1}" 
               data-id="${source.id}" data-source="${source.name}">
        <span class="volume-value small">${Math.round(
          (source.volume !== undefined ? source.volume : 1) * 100
        )}%</span>
      </div>
    `;
  }

  sourceEl.innerHTML = `
    <div class="source-info">
      <${isGroupItem ? "span" : "strong"}>${source.name}</${
    isGroupItem ? "span" : "strong"
  }>
      <div class="text-muted small">${source.type} (ID: ${source.id})</div>
      ${audioControls}
    </div>
    <div class="form-check form-switch">
      <input class="form-check-input source-toggle" type="checkbox" 
             data-source="${source.name}" 
             data-id="${source.id}"
             ${parentGroup ? `data-parent-group="${parentGroup}"` : ""}
             ${source.visible ? "checked" : ""}>
    </div>
  `;

  // Add event listeners
  const toggle = sourceEl.querySelector(".source-toggle");
  toggle.addEventListener("change", (e) => {
    toggleSourceVisibility(
      sceneName,
      e.target.dataset.id,
      e.target.dataset.source,
      e.target.checked,
      e.target.dataset.parentGroup
    );
  });

  // Add audio control event listeners if they exist
  const muteBtn = sourceEl.querySelector(".mute-btn");
  const volumeSlider = sourceEl.querySelector(".volume-slider");
  const volumeValue = sourceEl.querySelector(".volume-value");

  if (muteBtn && volumeSlider && volumeValue) {
    muteBtn.addEventListener("click", (e) => {
      const muted = muteBtn.classList.contains("btn-danger");
      toggleSourceMute(
        sceneName,
        e.target.dataset.id,
        e.target.dataset.source,
        !muted
      );
    });

    volumeSlider.addEventListener("input", (e) => {
      const volume = parseFloat(e.target.value);
      volumeValue.textContent = `${Math.round(volume * 100)}%`;
    });

    volumeSlider.addEventListener("change", (e) => {
      setSourceVolume(
        sceneName,
        e.target.dataset.id,
        e.target.dataset.source,
        parseFloat(e.target.value)
      );
    });
  }

  container.appendChild(sourceEl);
}

async function toggleSourceVisibility(sceneName, sourceId, sourceName, visible, parentGroup = null) {
  try {
    const res = await fetch("/api/toggle_source", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sceneName: parentGroup || sceneName,
        sourceName,
        sourceId: parseInt(sourceId),
        visible,
      }),
    });

    if (!res.ok) {
      const error = await res.json();
      console.error("Toggle error:", error);
    }
  } catch (err) {
    console.error("Error toggling source:", err);
  }
}

async function toggleSourceMute(sceneName, sourceId, sourceName, muted) {
  try {
    const res = await fetch("/api/toggle_mute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sceneName,
        sourceName,
        sourceId: parseInt(sourceId),
        muted,
      }),
    });

    if (res.ok) {
      // Update the button state
      const muteBtn = document.querySelector(
        `.mute-btn[data-id="${sourceId}"]`
      );
      if (muteBtn) {
        muteBtn.classList.toggle("btn-danger", muted);
        muteBtn.classList.toggle("btn-outline-secondary", !muted);
        const icon = muteBtn.querySelector("i");
        if (icon) {
          icon.className = muted
            ? "bi bi-volume-mute-fill"
            : "bi bi-volume-up-fill";
        }
      }
    }
  } catch (err) {
    console.error("Error toggling mute:", err);
  }
}

async function setSourceVolume(sceneName, sourceId, sourceName, volume) {
  try {
    const res = await fetch("/api/set_volume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sceneName,
        sourceName,
        sourceId: parseInt(sourceId),
        volume,
      }),
    });

    if (res.ok) {
      // Update the volume value display
      const volumeValue = document.querySelector(
        `.volume-slider[data-id="${sourceId}"] ~ .volume-value`
      );
      if (volumeValue) {
        volumeValue.textContent = `${Math.round(volume * 100)}%`;
      }
    }
  } catch (err) {
    console.error("Error setting volume:", err);
  }
}

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