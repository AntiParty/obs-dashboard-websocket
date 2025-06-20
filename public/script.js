// Global state
let currentScene = null;
let obsConnected = false;
let streaming = false;
let recording = false;
let connectionActive = false;
let checkInterval;
let scenePreviews = {};

// DOM elements
const obsStatusEl = document.getElementById("obsStatus");
const obsStatusTextEl = document.getElementById("obsStatusText");
const sceneSelectEl = document.getElementById("sceneSelect");
const switchBtnEl = document.getElementById("switchBtn");
const statusEl = document.getElementById("status");
const sourcesContainerEl = document.getElementById("sourcesContainer");
const streamBtnEl = document.getElementById("streamBtn");
const recordBtnEl = document.getElementById("recordBtn");
const currentPreviewEl = document.getElementById("currentPreview");
const currentPreviewLabelEl = document.getElementById("currentPreviewLabel");
const scenePreviewsEl = document.getElementById("scenePreviews");

// UI Update Functions
function updateUI(data) {
  if (data.connected) {
    obsConnected = true;
    streaming = data.streaming || false;
    recording = data.recording || false;
    updateStatusUI();
  } else {
    obsConnected = false;
    updateStatusUI();
  }
}

function showConnectionError() {
  obsConnected = false;
  updateStatusUI();
  statusEl.textContent = "Connection error - attempting to reconnect...";
  statusEl.style.color = "red";
}

function updateStatusUI() {
  if (obsConnected) {
    obsStatusEl.className = "status-indicator status-connected";
    obsStatusTextEl.textContent = "Connected to OBS";
    switchBtnEl.disabled = false;
    streamBtnEl.disabled = false;
    recordBtnEl.disabled = false;

    if (streaming) {
      streamBtnEl.innerHTML = '<i class="bi bi-broadcast"></i> Stop Stream';
      streamBtnEl.classList.remove("btn-warning");
      streamBtnEl.classList.add("btn-success");
    } else {
      streamBtnEl.innerHTML = '<i class="bi bi-broadcast"></i> Start Stream';
      streamBtnEl.classList.remove("btn-success");
      streamBtnEl.classList.add("btn-warning");
    }

    if (recording) {
      recordBtnEl.innerHTML =
        '<i class="bi bi-record-circle"></i> Stop Recording';
      recordBtnEl.classList.remove("btn-danger");
      recordBtnEl.classList.add("btn-secondary");
    } else {
      recordBtnEl.innerHTML =
        '<i class="bi bi-record-circle"></i> Start Recording';
      recordBtnEl.classList.remove("btn-secondary");
      recordBtnEl.classList.add("btn-danger");
    }
  } else {
    obsStatusEl.className = "status-indicator status-disconnected";
    obsStatusTextEl.textContent = "Disconnected from OBS";
    switchBtnEl.disabled = true;
    streamBtnEl.disabled = true;
    recordBtnEl.disabled = true;
  }
}

function renderSources(sources, sceneName) {
  sourcesContainerEl.innerHTML = `
    <h5 class="mb-3">${sceneName}</h5>
    <div class="audio-mixer-container mb-4">
      <h6>Audio Mixer</h6>
      <div id="audioMixer"></div>
    </div>
    <div id="sourceList"></div>
  `;

  const audioMixerEl = document.getElementById("audioMixer");
  const sourceListEl = document.getElementById("sourceList");

  // Render audio sources first
  sources.filter(source => source.isAudio).forEach(source => {
    renderAudioSource(source, audioMixerEl);
  });

  // Render non-audio sources
  sources.filter(source => !source.isAudio).forEach(source => {
    if (source.items) renderGroup(source, sceneName, sourceListEl);
    else renderSource(source, sceneName, sourceListEl);
  });
}

function renderAudioSource(source, container) {
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

async function updateAudioMeters() {
  if (!obsConnected) return;

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
setInterval(updateAudioMeters, 100);

// Connection Management
async function checkOBSStatus() {
  try {
    const response = await fetch("/api/obs-status");
    const data = await response.json();

    if (response.status === 200) {
      if (data.status === "inactive") {
        if (!connectionActive) return;
        console.log("Dashboard inactive - refreshing connection");
        connectionActive = false;
        statusEl.textContent = "Dashboard inactive - reconnecting...";
        statusEl.style.color = "orange";
        setTimeout(() => location.reload(), 2000);
        return;
      }

      connectionActive = true;
      updateUI(data);

      // Only load scenes if we haven't already
      if (sceneSelectEl.options.length <= 1) {
        loadScenes();
        loadScenePreviews();
      }

      // Update current preview if we have a scene selected
      if (currentScene && scenePreviews[currentScene]) {
        updateScenePreview(currentScene);
      }
    }
  } catch (error) {
    console.error("Error checking OBS status:", error);
    if (connectionActive) {
      connectionActive = false;
      showConnectionError();
    }
  }
}

function startStatusChecking() {
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

// Scene Management
async function loadScenes() {
  try {
    statusEl.textContent = "Loading scenes...";
    statusEl.style.color = "inherit";

    const res = await fetch("/api/scenes");
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.details || "Failed to load scenes");
    }

    const data = await res.json();
    sceneSelectEl.innerHTML = "";

    if (!data.scenes || data.scenes.length === 0) {
      throw new Error("No scenes found in OBS");
    }

    data.scenes.forEach((scene) => {
      const option = document.createElement("option");
      option.value = scene.name;
      option.textContent = scene.name;
      sceneSelectEl.appendChild(option);
    });

    statusEl.textContent = `Loaded ${data.scenes.length} scenes`;
    statusEl.style.color = "green";

    // Load sources for the first scene
    if (data.scenes.length > 0) {
      selectScene(data.scenes[0].name);
    }
  } catch (err) {
    console.error("Error loading scenes:", err);
    sceneSelectEl.innerHTML = '<option value="">Error loading scenes</option>';
    statusEl.textContent = err.message;
    statusEl.style.color = "red";
  }
}

function getPlaceholderImage(sceneName) {
  // Create a simple colored placeholder
  const canvas = document.createElement("canvas");
  canvas.width = 320;
  canvas.height = 180;
  const ctx = canvas.getContext("2d");

  // Background color based on scene name hash
  let hash = 0;
  for (let i = 0; i < sceneName.length; i++) {
    hash = sceneName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  ctx.fillStyle = `hsl(${hue}, 70%, 30%)`;
  ctx.fillRect(0, 0, 320, 180);

  // Text
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 16px Arial";
  ctx.textAlign = "center";
  ctx.fillText(sceneName, 160, 90);

  return canvas.toDataURL();
}

async function loadScenePreviews() {
  try {
    const res = await fetch("/api/scene-previews");

    if (!res.ok) {
      scenePreviewsEl.innerHTML = `
        <div class="alert alert-info">
          Scene previews not available
        </div>
      `;
      return;
    }

    const data = await res.json();
    scenePreviews = data.previews || {};
    scenePreviewsEl.innerHTML = "";

    Object.entries(scenePreviews).forEach(([sceneName, previewData]) => {
      const col = document.createElement("div");
      col.className = "col-6 col-md-4";

      const card = document.createElement("div");
      card.className = `scene-preview-card ${
        currentScene === sceneName ? "active" : ""
      }`;
      card.dataset.sceneName = sceneName;

      // Handle both raw base64 and complete data URLs
      const imgSrc =
        previewData && previewData.startsWith("data:image")
          ? previewData
          : previewData
          ? `data:image/png;base64,${previewData}`
          : getPlaceholderImage(sceneName);

      card.innerHTML = `
        <div class="scene-preview-inner">
          <img src="${imgSrc}" alt="${sceneName}" class="scene-preview-img">
          <div class="scene-preview-name">${sceneName}</div>
        </div>
      `;

      card.addEventListener("click", () => {
        sceneSelectEl.value = sceneName;
        selectScene(sceneName);
      });

      col.appendChild(card);
      scenePreviewsEl.appendChild(col);
    });

    // Update current preview if we have one
    if (currentScene && scenePreviews[currentScene]) {
      updateScenePreview(currentScene);
    }
  } catch (err) {
    console.error("Error loading previews:", err);
    scenePreviewsEl.innerHTML = `
      <div class="alert alert-info">
        Could not load scene previews
      </div>
    `;
  }
  try {
    const res = await fetch("/api/scene-previews");

    if (!res.ok) {
      scenePreviewsEl.innerHTML = `
        <div class="alert alert-info">
          Scene previews not available
        </div>
      `;
      return;
    }

    const data = await res.json();
    scenePreviews = data.previews || {};
    scenePreviewsEl.innerHTML = "";

    Object.entries(scenePreviews).forEach(([sceneName, previewData]) => {
      const col = document.createElement("div");
      col.className = "col-6 col-md-4";

      const card = document.createElement("div");
      card.className = `scene-preview-card ${
        currentScene === sceneName ? "active" : ""
      }`;
      card.dataset.sceneName = sceneName;

      // Use the preview data directly (it should already be a complete data URL)
      const imgSrc = previewData || getPlaceholderImage(sceneName);

      card.innerHTML = `
        <div class="scene-preview-inner">
          <img src="${imgSrc}" alt="${sceneName}" class="scene-preview-img">
          <div class="scene-preview-name">${sceneName}</div>
        </div>
      `;

      card.addEventListener("click", () => {
        sceneSelectEl.value = sceneName;
        selectScene(sceneName);
      });

      col.appendChild(card);
      scenePreviewsEl.appendChild(col);
    });

    // Update current preview if we have one
    if (currentScene && scenePreviews[currentScene]) {
      updateScenePreview(currentScene);
    }
  } catch (err) {
    console.error("Error loading previews:", err);
    scenePreviewsEl.innerHTML = `
      <div class="alert alert-info">
        Could not load scene previews
      </div>
    `;
  }
  try {
    const res = await fetch("/api/scene-previews");

    if (!res.ok) {
      scenePreviewsEl.innerHTML = `
        <div class="alert alert-info">
          Scene previews not available
        </div>
      `;
      return;
    }

    const data = await res.json();
    scenePreviewsEl.innerHTML = "";

    Object.entries(data.previews).forEach(([sceneName, imageData]) => {
      const col = document.createElement("div");
      col.className = "col-6 col-md-4";

      const card = document.createElement("div");
      card.className = `scene-preview-card ${
        currentScene === sceneName ? "active" : ""
      }`;
      card.dataset.sceneName = sceneName;

      // Only add data: prefix if we have image data
      const imgSrc = imageData
        ? `data:image/png;base64,${imageData}`
        : getPlaceholderImage(sceneName);

      card.innerHTML = `
        <div class="scene-preview-inner">
          <img src="${imgSrc}" alt="${sceneName}" class="scene-preview-img">
          <div class="scene-preview-name">${sceneName}</div>
        </div>
      `;

      card.addEventListener("click", () => {
        sceneSelectEl.value = sceneName;
        selectScene(sceneName);
      });

      col.appendChild(card);
      scenePreviewsEl.appendChild(col);
    });
  } catch (err) {
    console.error("Error loading previews:", err);
    scenePreviewsEl.innerHTML = `
      <div class="alert alert-info">
        Could not load scene previews
      </div>
    `;
  }
  try {
    const res = await fetch("/api/scene-previews");

    if (res.status === 404) {
      scenePreviewsEl.innerHTML = `
        <div class="alert alert-info">
          Scene previews not supported
        </div>
      `;
      return;
    }

    if (!res.ok) throw new Error("Failed to load previews");

    const data = await res.json();
    scenePreviews = data.previews || {};

    scenePreviewsEl.innerHTML = "";

    Object.entries(scenePreviews).forEach(([sceneName, previewData]) => {
      const col = document.createElement("div");
      col.className = "col-6 col-md-4";

      const card = document.createElement("div");
      card.className = `scene-preview-card ${
        currentScene === sceneName ? "active" : ""
      }`;
      card.dataset.sceneName = sceneName;

      // Construct the data URL properly
      const imgSrc = previewData.imageData
        ? `data:image/png;base64,${previewData.imageData}`
        : getPlaceholderImage(sceneName);

      card.innerHTML = `
        <div class="scene-preview-inner">
          <img src="${imgSrc}" alt="${sceneName}" class="scene-preview-img">
          <div class="scene-preview-name">${sceneName}</div>
        </div>
      `;

      card.addEventListener("click", () => {
        sceneSelectEl.value = sceneName;
        selectScene(sceneName);
      });

      col.appendChild(card);
      scenePreviewsEl.appendChild(col);
    });
  } catch (err) {
    console.error("Error loading previews:", err);
    scenePreviewsEl.innerHTML = `
      <div class="alert alert-info">
        Could not load scene previews
      </div>
    `;
  }
  try {
    const res = await fetch("/api/scene-previews");
    if (!res.ok) {
      // If we get a 404, don't show an error, just skip previews
      if (res.status === 404) {
        scenePreviewsEl.innerHTML = `
          <div class="alert alert-info">
            Scene previews not available
          </div>
        `;
        return;
      }
      throw new Error("Failed to load scene previews");
    }

    const data = await res.json();
    scenePreviews = data.previews || {};

    // Don't show anything if we have no previews
    if (Object.keys(scenePreviews).length === 0) {
      scenePreviewsEl.innerHTML = `
        <div class="alert alert-info">
          No scene previews available
        </div>
      `;
      return;
    }

    scenePreviewsEl.innerHTML = "";

    Object.entries(scenePreviews).forEach(([sceneName, previewData]) => {
      const col = document.createElement("div");
      col.className = "col-6 col-md-4";

      const card = document.createElement("div");
      card.className = `scene-preview-card ${
        currentScene === sceneName ? "active" : ""
      }`;
      card.dataset.sceneName = sceneName;

      card.innerHTML = `
        <div class="scene-preview-inner">
          <img src="${previewData.image}" alt="${sceneName}" class="scene-preview-img">
          <div class="scene-preview-name">${sceneName}</div>
        </div>
      `;

      card.addEventListener("click", () => {
        sceneSelectEl.value = sceneName;
        selectScene(sceneName);
      });

      col.appendChild(card);
      scenePreviewsEl.appendChild(col);
    });

    // Update current preview if we have one
    if (currentScene && scenePreviews[currentScene]) {
      updateScenePreview(currentScene);
    }
  } catch (err) {
    console.error("Error loading scene previews:", err);
    scenePreviewsEl.innerHTML = `
      <div class="alert alert-info">
        Scene previews not available
      </div>
    `;
  }
  try {
    const res = await fetch("/api/scene-previews");
    if (!res.ok) {
      throw new Error("Failed to load scene previews");
    }

    const data = await res.json();
    scenePreviews = data.previews || {};

    scenePreviewsEl.innerHTML = "";

    Object.entries(scenePreviews).forEach(([sceneName, previewData]) => {
      const col = document.createElement("div");
      col.className = "col-6 col-md-4";

      const card = document.createElement("div");
      card.className = `scene-preview-card ${
        currentScene === sceneName ? "active" : ""
      }`;
      card.dataset.sceneName = sceneName;

      card.innerHTML = `
            <div class="scene-preview-inner">
              <img src="${previewData.image}" alt="${sceneName}" class="scene-preview-img">
              <div class="scene-preview-name">${sceneName}</div>
            </div>
          `;

      card.addEventListener("click", () => {
        sceneSelectEl.value = sceneName;
        selectScene(sceneName);
      });

      col.appendChild(card);
      scenePreviewsEl.appendChild(col);
    });
  } catch (err) {
    console.error("Error loading scene previews:", err);
    scenePreviewsEl.innerHTML = `
          <div class="alert alert-warning">
            Could not load scene previews
          </div>
        `;
  }
}
function getSafeImageData(data, sceneName) {
  if (!data) return getPlaceholderImage(sceneName);
  try {
    return data.startsWith("data:image")
      ? data
      : `data:image/png;base64,${data}`;
  } catch (e) {
    console.error("Invalid image data:", e);
    return getPlaceholderImage(sceneName);
  }
}

function updateScenePreview(sceneName) {
  if (scenePreviews[sceneName]) {
    // Handle both raw base64 and complete data URLs
    const imgSrc = scenePreviews[sceneName].startsWith("data:image")
      ? scenePreviews[sceneName]
      : `data:image/png;base64,${scenePreviews[sceneName]}`;

    currentPreviewEl.src = imgSrc;
    currentPreviewLabelEl.textContent = sceneName;
    currentPreviewEl.style.display = "block";
  } else {
    currentPreviewEl.style.display = "none";
    currentPreviewLabelEl.textContent = sceneName || "No scene selected";
  }

  // Update active state in preview cards
  document.querySelectorAll(".scene-preview-card").forEach((card) => {
    if (card.dataset.sceneName === sceneName) {
      card.classList.add("active");
    } else {
      card.classList.remove("active");
    }
  });
  if (scenePreviews[sceneName] && scenePreviews[sceneName].image) {
    currentPreviewEl.src = scenePreviews[sceneName].image;
    currentPreviewLabelEl.textContent = sceneName;
    currentPreviewEl.style.display = "block";
  } else {
    currentPreviewEl.style.display = "none";
    currentPreviewLabelEl.textContent = sceneName || "No scene selected";
  }

  // Update active state in preview cards if they exist
  document.querySelectorAll(".scene-preview-card").forEach((card) => {
    if (card.dataset.sceneName === sceneName) {
      card.classList.add("active");
    } else {
      card.classList.remove("active");
    }
  });
}

async function selectScene(sceneName) {
  currentScene = sceneName;
  updateScenePreview(sceneName);

  try {
    sourcesContainerEl.innerHTML = `
      <div class="text-center py-3">
        <div class="spinner-border" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p>Loading sources for ${sceneName}...</p>
      </div>
    `;

    const res = await fetch(`/api/sources/${encodeURIComponent(sceneName)}`);

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to fetch sources");
    }

    const data = await res.json();

    if (!data.sources || data.sources.length === 0) {
      sourcesContainerEl.innerHTML = `
        <div class="alert alert-warning">
          No sources found in scene "${sceneName}"
        </div>
      `;
      return;
    }

    renderSources(data.sources, sceneName);
  } catch (err) {
    console.error("Error loading sources:", err);
    sourcesContainerEl.innerHTML = `
      <div class="alert alert-danger">
        Error loading sources: ${err.message}
        ${currentScene ? `<p>Current scene: ${currentScene}</p>` : ""}
      </div>
    `;
  }
}

function renderSources(sources, sceneName) {
  sourcesContainerEl.innerHTML = `
    <h5 class="mb-3">${sceneName}</h5>
    <div id="sourceList"></div>
  `;

  const sourceListEl = document.getElementById("sourceList");
  sourceListEl.innerHTML = "";

  sources.forEach((source) => {
    if (source.items) {
      // This is a group
      renderGroup(source, sceneName, sourceListEl);
    } else {
      // This is a regular source
      renderSource(source, sceneName, sourceListEl);
    }
  });
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

function renderSource(
  source,
  sceneName,
  container,
  isGroupItem = false,
  parentGroup = null
) {
  const sourceEl = document.createElement("div");
  sourceEl.className = isGroupItem ? "group-item" : "source-item";

  let audioControls = "";
  if (
    source.type.includes("AUDIO") ||
    source.type === "wasapi_input_capture" ||
    source.type === "wasapi_output_capture"
  ) {
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
async function switchScene() {
  const sceneName = sceneSelectEl.value;
  if (!sceneName) return;

  try {
    statusEl.textContent = `Switching to ${sceneName}...`;
    statusEl.style.color = "inherit";

    const res = await fetch("/api/switch_scene", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sceneName }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.details || "Failed to switch scene");
    }

    const data = await res.json();
    statusEl.textContent = data.message;
    statusEl.style.color = "green";
    selectScene(sceneName);
  } catch (err) {
    console.error("Error switching scene:", err);
    statusEl.textContent = err.message;
    statusEl.style.color = "red";
  }
}

async function toggleSourceVisibility(
  sceneName,
  sourceId,
  sourceName,
  visible,
  parentGroup = null
) {
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

// Stream and Recording Controls
async function toggleStream() {
  try {
    const action = streaming ? "stop" : "start";
    const res = await fetch("/api/streaming", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    if (res.ok) {
      streaming = !streaming;
      updateStatusUI();
    }
  } catch (err) {
    console.error("Error controlling stream:", err);
  }
}

async function toggleRecording() {
  try {
    const action = recording ? "stop" : "start";
    const res = await fetch("/api/recording", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    if (res.ok) {
      recording = !recording;
      updateStatusUI();
    }
  } catch (err) {
    console.error("Error controlling recording:", err);
  }
}

// Event Listeners
function setupEventListeners() {
  sceneSelectEl.addEventListener("change", () => {
    if (sceneSelectEl.value) {
      selectScene(sceneSelectEl.value);
    }
  });

  switchBtnEl.addEventListener("click", switchScene);
  streamBtnEl.addEventListener("click", toggleStream);
  recordBtnEl.addEventListener("click", toggleRecording);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (checkInterval) clearInterval(checkInterval);
    } else {
      window.statusCleanup = startStatusChecking();
    }
  });
}

// Initialize
window.addEventListener("load", () => {
  setupEventListeners();
  window.statusCleanup = startStatusChecking();
  updateStatusUI(); // Initial UI update
});