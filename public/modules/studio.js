let currentScene = "";

async function fetchScenes() {
  const res = await fetch("/api/scenes");
  return (await res.json()).scenes || [];
}

async function fetchSources(sceneName) {
  const res = await fetch(`/api/sources/${encodeURIComponent(sceneName)}`);
  return (await res.json()).sources || [];
}

async function fetchPreview(sceneName) {
  const res = await fetch(`/api/source-preview/${sceneName}`);
  const data = await res.json();
  return data.preview;
}

function renderSources(sources) {
  const list = document.getElementById("studioSourcesList");
  list.innerHTML = "";
  sources.forEach((src) => {
    const el = document.createElement("div");
    el.className =
      "list-group-item d-flex justify-content-between align-items-center";
    el.innerHTML = `
      <div>
        <strong>${src.name}</strong> 
        <small class="text-muted">[${src.type}]</small>
      </div>
      <div class="btn-group btn-group-sm">
        <button class="btn btn-outline-primary toggle" 
                data-id="${src.id}" data-name="${src.name}" data-visible="${
      src.visible
    }">
          ${src.visible ? "Hide" : "Show"}
        </button>
        <button class="btn btn-outline-danger delete" 
                data-id="${src.id}" data-name="${src.name}">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `;
    list.appendChild(el);
  });
}

function renderAudioMixer(sources) {
  const container = document.getElementById("audioMixerStudio");
  container.innerHTML = "";
  const audioSources = sources.filter((s) => s.isAudio);

  if (audioSources.length === 0) {
    container.innerHTML = "<div class='text-muted'>No audio sources</div>";
    return;
  }

  audioSources.forEach((source) => {
    const wrapper = document.createElement("div");
    wrapper.className = "mb-3";
    wrapper.innerHTML = `
      <label class="form-label">${source.name}</label>
      <div class="d-flex align-items-center gap-2">
        <input type="range" class="form-range volume" min="0" max="1" step="0.01"
               value="${source.volume}" data-name="${source.name}" data-id="${
      source.id
    }" />
        <button class="btn btn-sm ${
          source.muted ? "btn-danger" : "btn-outline-secondary"
        } mute"
                data-name="${source.name}" data-muted="${
      source.muted
    }" data-id="${source.id}">
          ${source.muted ? "Unmute" : "Mute"}
        </button>
      </div>
    `;
    container.appendChild(wrapper);
  });
}

async function updateSourceVisibility(scene, sourceId, sourceName, visible) {
  await fetch("/api/toggle_source", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sceneName: scene, sourceId, sourceName, visible }),
  });
}

async function setVolume(sourceName, volume) {
  await fetch("/api/set_volume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceName, volume }),
  });
}

async function toggleMute(sourceName, muted) {
  await fetch("/api/toggle_mute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceName, muted }),
  });
}

async function deleteSource(sceneName, sourceId, sourceName) {
  await fetch("/api/delete_source", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sceneName, sourceId, sourceName }),
  });
}

async function addSource(sceneName, formData) {
  const inputKind = formData.get("inputKind");
  const sourceName = formData.get("sourceName");

  const body = {
    sceneName,
    sourceName,
    inputKind,
  };

  if (inputKind === "browser_source") {
    body.inputSettings = {
      url: formData.get("url"),
      width: parseInt(formData.get("width") || "1280"),
      height: parseInt(formData.get("height") || "720"),
    };
  } else {
    body.inputSettings = {};
  }

  await fetch("/api/add_source", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const sceneSelect = document.getElementById("studioSceneSelect");
  const sourceList = document.getElementById("studioSourcesList");
  const previewImage = document.getElementById("scenePreviewImage");
  const modal = new bootstrap.Modal(document.getElementById("addSourceModal"));
  const form = document.getElementById("addSourceForm");

  const inputKind = document.getElementById("inputKindSelect");
  inputKind.addEventListener("change", () => {
    const browserSettings = document.getElementById("browserSettings");
    const urlField = browserSettings.querySelector("input[name='url']");
    browserSettings.style.display =
      inputKind.value === "browser_source" ? "block" : "none";
    urlField.required = inputKind.value === "browser_source";
  });

  // Load scenes into dropdown
  fetchScenes().then((scenes) => {
    sceneSelect.innerHTML = `<option value="">Select scene...</option>`;
    scenes.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.name;
      opt.textContent = s.name;
      sceneSelect.appendChild(opt);
    });
  });

  sceneSelect.addEventListener("change", async () => {
    const scene = sceneSelect.value;
    if (!scene) return;

    currentScene = scene;
    const sources = await fetchSources(scene);
    const preview = await fetchPreview(scene);
    previewImage.src = preview || ""; // ✅ Fixed line
    renderSources(sources);
    renderAudioMixer(sources);
  });

  document
    .getElementById("refreshSources")
    .addEventListener("click", async () => {
      if (!currentScene) return;
      const sources = await fetchSources(currentScene);
      renderSources(sources);
      renderAudioMixer(sources);
    });

  sourceList.addEventListener("click", async (e) => {
    const btn = e.target.closest("button");

    if (btn.classList.contains("toggle")) {
      const visible = btn.dataset.visible === "true";
      const id = parseInt(btn.dataset.id);
      const name = btn.dataset.name;

      await updateSourceVisibility(currentScene, id, name, !visible);
      const sources = await fetchSources(currentScene);
      renderSources(sources);
    }

    if (btn.classList.contains("delete")) {
      const id = parseInt(btn.dataset.id);
      const name = btn.dataset.name;

      // Skip deletion if the source ID is not a number (e.g., audio-only sources)
      if (isNaN(id)) {
        alert(`"${name}" cannot be deleted because it is not a scene item.`);
        return;
      }

      const confirmed = confirm(`Are you sure you want to delete "${name}"?`);
      if (!confirmed) return;

      await deleteSource(currentScene, id, name);
      const sources = await fetchSources(currentScene);
      renderSources(sources);
      renderAudioMixer(sources);
    }
  });

  document
    .getElementById("audioMixerStudio")
    .addEventListener("input", async (e) => {
      if (e.target.classList.contains("volume")) {
        const name = e.target.dataset.name;
        const volume = parseFloat(e.target.value);
        await setVolume(name, volume);
      }
    });

  document
    .getElementById("audioMixerStudio")
    .addEventListener("click", async (e) => {
      if (e.target.classList.contains("mute")) {
        const name = e.target.dataset.name;
        const muted = e.target.dataset.muted === "true";
        await toggleMute(name, !muted);
        const sources = await fetchSources(currentScene);
        renderAudioMixer(sources);
      }
    });

  document.getElementById("addSourceBtn").addEventListener("click", () => {
    form.reset();
    document.getElementById("browserSettings").style.display = "none";
    modal.show();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentScene) return;
    const formData = new FormData(form);
    await addSource(currentScene, formData);
    modal.hide();
    const sources = await fetchSources(currentScene);
    renderSources(sources);
    renderAudioMixer(sources);
  });
});


let layoutEditMode = false;
const toggleLayoutBtn = document.getElementById("toggleLayoutBtn");
const layoutEditor = document.getElementById("layoutEditor");

toggleLayoutBtn.addEventListener("click", async () => {
  layoutEditMode = !layoutEditMode;
  layoutEditor.style.display = layoutEditMode ? "block" : "none";
  toggleLayoutBtn.textContent = layoutEditMode ? "Exit Layout Editor" : "Edit Layout";

  if (layoutEditMode) {
    layoutEditor.innerHTML = "";
    const sources = await fetchSources(currentScene);

    // Flatten sources: skip groups themselves, but add group items if browser/image/color sources
    const flatSources = [];

    sources.forEach((src) => {
      if (src.type === "group" && Array.isArray(src.items)) {
        src.items.forEach((item) => {
          if (
            !item.isAudio &&
            (item.type === "browser_source" || item.type === "image_source" || item.type === "color_source")
          ) {
            flatSources.push({
              id: item.id,
              name: item.name,
              type: item.type,
              x: item.x,
              y: item.y,
            });
          }
        });
      } else if (!src.isAudio && src.type !== "group") {
        flatSources.push(src);
      }
    });

    flatSources.forEach((src, i) => {
      const el = document.createElement("div");
      el.className = "draggable-obs-source";
      el.style.position = "absolute";
      el.style.width = "100px";
      el.style.height = "30px";
      el.style.background = "#0d6efd";
      el.style.color = "#fff";
      el.style.fontSize = "12px";
      el.style.cursor = "move";
      el.style.padding = "2px 6px";
      el.style.borderRadius = "4px";
      el.textContent = src.name;

      // Use saved position or fallback grid layout
      const xPos = typeof src.x === "number" ? src.x / 2 : (i % 10) * 110;
      const yPos = typeof src.y === "number" ? src.y / 2 : Math.floor(i / 10) * 40;

      el.style.left = xPos + "px";
      el.style.top = yPos + "px";

      makeDraggable(el, src.id);
      layoutEditor.appendChild(el);
    });
  }
});

function makeDraggable(element, sourceId) {
  let offsetX, offsetY, isDragging = false;

  element.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.offsetX;
    offsetY = e.offsetY;
    element.style.zIndex = 999;
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const parentRect = layoutEditor.getBoundingClientRect();
    let x = e.clientX - parentRect.left - offsetX;
    let y = e.clientY - parentRect.top - offsetY;

    x = Math.max(0, Math.min(x, layoutEditor.offsetWidth - element.offsetWidth));
    y = Math.max(0, Math.min(y, layoutEditor.offsetHeight - element.offsetHeight));

    element.style.left = x + "px";
    element.style.top = y + "px";
  });

  document.addEventListener("mouseup", async () => {
    if (!isDragging) return;
    isDragging = false;
    element.style.zIndex = "";

    const x = parseInt(element.style.left, 10) * 2;
    const y = parseInt(element.style.top, 10) * 2;

    await fetch("/api/set_position", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sceneName: currentScene,
        sceneItemId: sourceId,
        x,
        y,
      }),
    });
  });
}