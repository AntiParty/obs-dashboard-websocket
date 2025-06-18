const express = require("express");
const path = require("path");
const OBSWebSocket = require("obs-websocket-js").default;
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const obs = new OBSWebSocket();

const config = {
  host: process.env.OBS_HOST || "1.1.1.1",
  port: process.env.OBS_PORT || 4455,
  password: process.env.OBS_PASSWORD || "test123",
  serverPort: process.env.SERVER_PORT || 2000,
};

// State management
const activeClients = new Map();
let isConnected = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;
const CLIENT_TIMEOUT = 30000; // 30 seconds
const CONNECTION_TIMEOUT = 5000; // 5 seconds

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Track client activity
app.use((req, res, next) => {
  const clientId = req.ip;

  if (req.path === "/" || req.path.startsWith("/api/")) {
    activeClients.set(clientId, Date.now());
    cleanupInactiveClients();
  }
  next();
});

function cleanupInactiveClients() {
  const now = Date.now();
  for (const [id, lastActive] of activeClients) {
    if (now - lastActive > CLIENT_TIMEOUT) {
      activeClients.delete(id);
    }
  }
}

async function connectToOBS() {
  if (isConnected) return true;

  try {
    console.log("Attempting to connect to OBS...");
    const url = `ws://${config.host}:${config.port}`;

    await Promise.race([
      obs.connect(url, config.password),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Connection timeout")),
          CONNECTION_TIMEOUT
        )
      ),
    ]);

    console.log("Successfully connected to OBS");
    isConnected = true;
    connectionAttempts = 0;
    return true;
  } catch (error) {
    connectionAttempts++;
    console.error(
      `Connection attempt ${connectionAttempts} failed:`,
      error.message
    );

    if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
      console.log("Max connection attempts reached. Waiting for new requests.");
    }
    return false;
  }
}

function checkIdleAndDisconnect() {
  cleanupInactiveClients();

  if (activeClients.size === 0 && isConnected) {
    console.log("No active clients - disconnecting from OBS");
    obs.disconnect();
    isConnected = false;
  }
}

// Helper for API endpoints
async function handleOBSCall(res, obsMethod, params = {}) {
  try {
    const connected = await connectToOBS();
    if (!connected) {
      return res.status(503).json({
        error: "OBS not available",
        details:
          "Could not connect to OBS. Please ensure OBS is running with WebSocket server enabled.",
      });
    }

    const result = await obs.call(obsMethod, params);
    return result;
  } catch (error) {
    console.error("OBS operation failed:", error);
    isConnected = false;
    throw error;
  } finally {
    checkIdleAndDisconnect();
  }
}

// API Endpoints
app.get("/api/obs-status", async (req, res) => {
  try {
    const status = await handleOBSCall(res, "GetStreamStatus");
    res.json({
      connected: true,
      streaming: status.outputActive,
      recording: status.outputActive,
    });
  } catch (error) {
    res.json({ connected: false, error: error.message });
  }
});

app.get("/api/scenes", async (req, res) => {
  try {
    const response = await handleOBSCall(res, "GetSceneList");

    if (!response?.scenes) {
      throw new Error("Invalid response from OBS");
    }

    // Get scene previews if available
    const scenesWithPreviews = await Promise.all(
      response.scenes.map(async (scene) => {
        let preview = null;
        try {
          // Try to get scene preview (OBS 28+ required)
          const previewData = await handleOBSCall(res, "GetSourceScreenshot", {
            sourceName: scene.sceneName,
            imageFormat: "jpeg",
            imageWidth: 320,
            imageHeight: 180,
            imageCompressionQuality: 70,
          });
          preview = previewData.imageData;
        } catch (e) {
          console.log(
            `Could not get preview for ${scene.sceneName}:`,
            e.message
          );
        }

        return {
          name: scene.sceneName,
          sources: scene.sources?.map((source) => source.sourceName) || [],
          preview,
        };
      })
    );

    res.json({ scenes: scenesWithPreviews });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      details: "Failed to get scenes from OBS",
    });
  }
});

app.get("/api/audio-levels", async (req, res) => {
  try {
    const inputs = await handleOBSCall(res, "GetInputList");
    const levels = {};

    for (const input of inputs.inputs) {
      try {
        // Check if input supports audio first
        await handleOBSCall(res, "GetInputAudioTracks", {
          inputName: input.inputName,
        });
        
        // Only proceed if input supports audio
        const { inputLevels } = await handleOBSCall(res, "GetInputAudioMonitor", {
          inputName: input.inputName,
        });
        levels[input.inputName] = inputLevels?.[0]?.[0] || 0; // Get peak level
      } catch (error) {
        // Skip non-audio inputs
        continue;
      }
    }

    res.json(levels);
  } catch (error) {
    res.json({});
  }
});

app.get("/api/sources/:sceneName", async (req, res) => {
  try {
    const { sceneName } = req.params;

    // Verify scene exists and get its type (regular scene or group)
    const sceneList = await handleOBSCall(res, "GetSceneList");
    const groupList = await handleOBSCall(res, "GetGroupList");
    const inputs = await handleOBSCall(res, "GetInputList"); // Get all audio inputs
    const audioSources = [];

    const sceneNames = sceneList.scenes.map((scene) => scene.sceneName);
    const groupNames = groupList.groups || [];

    const isGroup = groupNames.includes(sceneName);
    const sceneExists = sceneNames.includes(sceneName) || isGroup;

    if (!sceneExists) {
      return res.status(404).json({
        error: "Scene/Group not found",
        availableScenes: sceneNames,
        availableGroups: groupNames,
      });
    }

    // Get scene/group items
    const itemsResponse = isGroup
      ? await handleOBSCall(res, "GetGroupSceneItemList", { sceneName })
      : await handleOBSCall(res, "GetSceneItemList", { sceneName });

    const sceneItems = itemsResponse.sceneItems;
    const processedSources = [];
    const groupPromises = [];

    // Gather audio sources
    for (const input of inputs.inputs) {
      try {
        const inputInfo = await handleOBSCall(res, "GetInputAudioTracks", {
          inputName: input.inputName,
        }).catch(() => null);

        if (inputInfo) {
          const volume = await handleOBSCall(res, "GetInputVolume", {
            inputName: input.inputName,
          });
          const muted = await handleOBSCall(res, "GetInputMute", {
            inputName: input.inputName,
          });

          audioSources.push({
            id: input.inputId || Date.now(),
            name: input.inputName,
            type: input.inputKind,
            volume: volume.inputVolumeMul,
            muted: muted.inputMuted,
            isAudio: true,
          });
        }
      } catch (err) {
        console.warn(
          `Skipping non-audio input "${input.inputName}":`,
          err.message
        );
      }
    }

    for (const item of sceneItems) {
      if (item.parentGroupName) continue;

      if (item.isGroup || item.sourceType === "OBS_SOURCE_TYPE_GROUP") {
        groupPromises.push(
          handleOBSCall(res, "GetGroupSceneItemList", {
            sceneName: item.sourceName,
          })
            .then(({ sceneItems: groupItems }) => ({
              id: item.sceneItemId,
              name: item.sourceName,
              type: "group",
              visible: item.sceneItemEnabled,
              items: groupItems.map((i) => ({
                id: i.sceneItemId,
                name: i.sourceName,
                type: i.sourceType,
                visible: i.sceneItemEnabled,
                isGroupItem: true,
                parentGroup: item.sourceName,
              })),
            }))
            .catch((error) => {
              console.error(
                `Error processing group ${item.sourceName}:`,
                error
              );
              return {
                id: item.sceneItemId,
                name: item.sourceName,
                type: "group",
                visible: item.sceneItemEnabled,
                items: [],
                error: "Failed to load group contents",
              };
            })
        );
      } else {
        processedSources.push({
          id: item.sceneItemId,
          name: item.sourceName,
          type: item.sourceType,
          visible: item.sceneItemEnabled,
        });
      }
    }

    const groupResults = await Promise.all(groupPromises);
    processedSources.push(...groupResults);

    // Send combined response
    res.json({
      sources: [...processedSources, ...audioSources],
      sceneName,
      isGroup,
    });
  } catch (error) {
    console.error("Error in /api/sources:", error);
    res.status(500).json({
      error: error.message,
      details: "Failed to get scene/group sources",
    });
  }
});

app.get("/api/source-preview/:sourceName", async (req, res) => {
  try {
    const { sourceName } = req.params;
    const previewData = await handleOBSCall(res, "GetSourceScreenshot", {
      sourceName,
      imageFormat: "jpeg",
      imageWidth: 320,
      imageHeight: 180,
      imageCompressionQuality: 70,
    });

    res.json({ preview: previewData.imageData });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      details: "Failed to get source preview",
    });
  }
});

app.post("/api/switch_scene", async (req, res) => {
  try {
    const { sceneName } = req.body;
    if (!sceneName) {
      return res.status(400).json({
        error: "sceneName is required",
        details: "Please provide a sceneName in the request body",
      });
    }

    // Verify scene exists
    const { scenes } = await handleOBSCall(res, "GetSceneList");
    if (!scenes.some((scene) => scene.sceneName === sceneName)) {
      return res.status(404).json({
        error: "Scene not found",
        details: `Scene "${sceneName}" does not exist in OBS`,
      });
    }

    await handleOBSCall(res, "SetCurrentProgramScene", { sceneName });
    res.json({
      status: "success",
      scene: sceneName,
      message: `Successfully switched to scene: ${sceneName}`,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      details: "Failed to switch scene",
    });
  }
});

app.post("/api/toggle_source", async (req, res) => {
  try {
    const { sceneName, sourceName, sourceId, visible } = req.body;
    if (!sceneName || !sourceName || typeof visible !== "boolean") {
      return res.status(400).json({ error: "Invalid parameters" });
    }

    await handleOBSCall(res, "SetSceneItemEnabled", {
      sceneName,
      sceneItemId: sourceId,
      sceneItemEnabled: visible,
    });

    res.json({
      status: "success",
      sceneName,
      sourceName,
      sourceId,
      visible,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      details: "Failed to toggle source visibility",
    });
  }
});

app.post("/api/streaming", async (req, res) => {
  try {
    const { action } = req.body;
    if (action !== "start" && action !== "stop") {
      return res.status(400).json({ error: "Invalid action" });
    }

    await handleOBSCall(res, action === "start" ? "StartStream" : "StopStream");
    res.json({ status: "success", action });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/scene-previews", async (req, res) => {
  try {
    if (!isConnected) {
      return res.status(503).json({ error: "Not connected to OBS" });
    }

    const { scenes } = await handleOBSCall(res, "GetSceneList");
    const previews = {};

    for (const scene of scenes) {
      try {
        const { imageData } = await handleOBSCall(res, "GetSourceScreenshot", {
          sourceName: scene.sceneName,
          imageFormat: "png",
          imageWidth: 320,
          imageHeight: 180,
        });

        // Return the complete data URL
        previews[scene.sceneName] = imageData.startsWith("data:image")
          ? imageData
          : `data:image/png;base64,${imageData}`;
      } catch (error) {
        console.error(`Failed to get preview for ${scene.sceneName}:`, error);
        previews[scene.sceneName] = null;
      }
    }

    res.json({ previews });
  } catch (error) {
    console.error("Error getting previews:", error);
    res.status(500).json({ error: "Failed to get scene previews" });
  }
});

app.post("/api/toggle_mute", async (req, res) => {
  try {
    const { sceneName, sourceName, sourceId, muted } = req.body;

    await handleOBSCall(res, "SetInputMute", {
      inputName: sourceName,
      inputMuted: muted,
    });

    res.json({
      status: "success",
      sceneName,
      sourceName,
      sourceId,
      muted,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      details: "Failed to toggle mute",
    });
  }
});

app.post("/api/set_volume", async (req, res) => {
  try {
    const { sceneName, sourceName, sourceId, volume } = req.body;

    await handleOBSCall(res, "SetInputVolume", {
      inputName: sourceName,
      inputVolumeMul: volume,
    });

    res.json({
      status: "success",
      sceneName,
      sourceName,
      sourceId,
      volume,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      details: "Failed to set volume",
    });
  }
});

app.post("/api/recording", async (req, res) => {
  try {
    const { action } = req.body;
    if (action !== "start" && action !== "stop") {
      return res.status(400).json({ error: "Invalid action" });
    }

    await handleOBSCall(res, action === "start" ? "StartRecord" : "StopRecord");
    res.json({ status: "success", action });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/verify-connection", async (req, res) => {
  try {
    await handleOBSCall(res, "GetVersion");
    res.json({ connected: true });
  } catch (error) {
    res.json({ connected: false, error: error.message });
  }
});

// Start server
app.listen(config.serverPort, () => {
  console.log(`Server running at http://localhost:${config.serverPort}`);
});

// Clean up on exit
process.on("SIGINT", () => {
  if (isConnected) {
    obs.disconnect();
  }
  process.exit();
});