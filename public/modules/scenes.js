import { DOM, STATE } from './constants.js';
import { updateScenePreview, getPlaceholderImage } from './ui.js';
import { renderSources } from './sources.js';

export async function loadScenes() {
  try {
    DOM.statusEl.textContent = "Loading scenes...";
    DOM.statusEl.style.color = "inherit";

    const res = await fetch("/api/scenes");
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.details || "Failed to load scenes");
    }

    const data = await res.json();
    DOM.sceneSelectEl.innerHTML = "";

    if (!data.scenes || data.scenes.length === 0) {
      throw new Error("No scenes found in OBS");
    }

    data.scenes.forEach((scene) => {
      const option = document.createElement("option");
      option.value = scene.name;
      option.textContent = scene.name;
      DOM.sceneSelectEl.appendChild(option);
    });

    DOM.statusEl.textContent = `Loaded ${data.scenes.length} scenes`;
    DOM.statusEl.style.color = "green";

    // Load sources for the first scene
    if (data.scenes.length > 0) {
      selectScene(data.scenes[0].name);
    }
  } catch (err) {
    console.error("Error loading scenes:", err);
    DOM.sceneSelectEl.innerHTML = '<option value="">Error loading scenes</option>';
    DOM.statusEl.textContent = err.message;
    DOM.statusEl.style.color = "red";
  }
}

export async function loadScenePreviews() {
  try {
    const res = await fetch("/api/scene-previews");

    if (!res.ok) {
      DOM.scenePreviewsEl.innerHTML = `
        <div class="alert alert-info">
          Scene previews not available
        </div>
      `;
      return;
    }

    const data = await res.json();
    STATE.scenePreviews = data.previews || {};
    DOM.scenePreviewsEl.innerHTML = "";

    Object.entries(STATE.scenePreviews).forEach(([sceneName, previewData]) => {
      const col = document.createElement("div");
      col.className = "col-6 col-md-4";

      const card = document.createElement("div");
      card.className = `scene-preview-card ${
        STATE.currentScene === sceneName ? "active" : ""
      }`;
      card.dataset.sceneName = sceneName;

      const imgSrc = previewData && previewData.startsWith("data:image")
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
        DOM.sceneSelectEl.value = sceneName;
        selectScene(sceneName);
      });

      col.appendChild(card);
      DOM.scenePreviewsEl.appendChild(col);
    });

    // Update current preview if we have one
    if (STATE.currentScene && STATE.scenePreviews[STATE.currentScene]) {
      updateScenePreview(STATE.currentScene);
    }
  } catch (err) {
    console.error("Error loading previews:", err);
    DOM.scenePreviewsEl.innerHTML = `
      <div class="alert alert-info">
        Could not load scene previews
      </div>
    `;
  }
}

export async function selectScene(sceneName) {
  STATE.currentScene = sceneName;
  updateScenePreview(sceneName);

  try {
    DOM.sourcesContainerEl.innerHTML = `
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
      DOM.sourcesContainerEl.innerHTML = `
        <div class="alert alert-warning">
          No sources found in scene "${sceneName}"
        </div>
      `;
      return;
    }

    renderSources(data.sources, sceneName);
  } catch (err) {
    console.error("Error loading sources:", err);
    DOM.sourcesContainerEl.innerHTML = `
      <div class="alert alert-danger">
        Error loading sources: ${err.message}
        ${STATE.currentScene ? `<p>Current scene: ${STATE.currentScene}</p>` : ""}
      </div>
    `;
  }
}

export async function fetchAndDisplayActiveScene() {
  try {
    const res = await fetch('/api/active-scene');
    const data = await res.json();
    document.getElementById('obsActiveSceneName').textContent = data.activeScene || 'Unknown';
  } catch (err) {
    document.getElementById('obsActiveSceneName').textContent = 'Unavailable';
  }
}

export async function switchScene() {
  const sceneName = DOM.sceneSelectEl.value;
  if (!sceneName) return;

  try {
    DOM.statusEl.textContent = `Switching to ${sceneName}...`;
    DOM.statusEl.style.color = "inherit";

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
    DOM.statusEl.textContent = data.message;
    DOM.statusEl.style.color = "green";
    selectScene(sceneName);
    await fetchAndDisplayActiveScene();
  } catch (err) {
    console.error("Error switching scene:", err);
    DOM.statusEl.textContent = err.message;
    DOM.statusEl.style.color = "red";
  }
}