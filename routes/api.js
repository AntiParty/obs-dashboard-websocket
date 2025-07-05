const fs = require("fs");
const path = require("path");

module.exports = function (
  config,
  discordWebhookUrl,
  activeClients,
  obsConnections,
  obsManager
) {
  const express = require("express");
  const router = express.Router();
  const imgFolder = path.join(__dirname, "..", "public", "img");

  // Helper for API endpoints
  async function handleOBSCall(res, obsMethod, params = {}) {
    try {
      const result = await obsManager.call(obsMethod, params);
      return result;
    } catch (error) {
      return res.status(503).json({
        error: "OBS not available",
        details: error.message || "Could not connect to OBS.",
      });
    } finally {
      obsManager.disconnectIfIdle(activeClients);
    }
  }

  // --- Begin all routes ---
  router.get("/obs-status", async (req, res) => {
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

  router.post("/save-obs-config", (req, res) => {
    const { ip, port, password } = req.body;
    const clientId = req.ip;
    if (!ip || !port || !password) {
      return res.status(400).json({ error: "Missing fields" });
    }
    obsConnections.set(clientId, { ip, port, password });
    res.json({ status: "saved" });
  });

  router.get("/scenes", async (req, res) => {
    try {
      const response = await handleOBSCall(res, "GetSceneList");
      if (!response?.scenes) throw new Error("Invalid response from OBS");
      const scenesWithPreviews = await Promise.all(
        response.scenes.map(async (scene) => {
          let preview = null;
          try {
            const previewData = await handleOBSCall(
              res,
              "GetSourceScreenshot",
              {
                sourceName: scene.sceneName,
                imageFormat: "jpeg",
                imageWidth: 320,
                imageHeight: 180,
                imageCompressionQuality: 70,
              }
            );
            preview = previewData.imageData;
          } catch (e) {
            // ignore
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
      res
        .status(500)
        .json({
          error: error.message,
          details: "Failed to get scenes from OBS",
        });
    }
  });

  router.get("/active-scene", async (req, res) => {
    try {
      const result = await handleOBSCall(res, "GetCurrentProgramScene");
      res.json({ activeScene: result.currentProgramSceneName });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/audio-levels", async (req, res) => {
    try {
      const inputs = await handleOBSCall(res, "GetInputList");
      const levels = {};
      for (const input of inputs.inputs) {
        try {
          await handleOBSCall(res, "GetInputAudioTracks", {
            inputName: input.inputName,
          });
          const { inputLevels } = await handleOBSCall(
            res,
            "GetInputAudioMonitor",
            { inputName: input.inputName }
          );
          levels[input.inputName] = inputLevels?.[0]?.[0] || 0;
        } catch (error) {
          continue;
        }
      }
      res.json(levels);
    } catch (error) {
      res.json({});
    }
  });

  router.get("/sources/:sceneName", async (req, res) => {
    try {
      const { sceneName } = req.params;
      if (!sceneName)
        return res.status(400).json({ error: "sceneName parameter missing" });
      const { scenes } = await handleOBSCall(res, "GetSceneList");
      const sceneExists = scenes.some((s) => s.sceneName === sceneName);
      if (!sceneExists)
        return res
          .status(404)
          .json({ error: `Scene \"${sceneName}\" not found` });
      const { sceneItems } = await handleOBSCall(res, "GetSceneItemList", {
        sceneName,
      });
      if (!sceneItems) return res.json({ sources: [] });
      const sources = sceneItems.map((item) => ({
        id: item.sceneItemId,
        name: item.sourceName,
        type: item.sourceType,
        visible: item.sceneItemEnabled,
        isAudio: item.sourceType.toLowerCase().includes("audio"),
        x: item.sceneItemTransform?.positionX || 0,
        y: item.sceneItemTransform?.positionY || 0,
      }));
      res.json({ sources });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/source-preview/:sourceName", async (req, res) => {
    try {
      const sourceName = req.params.sourceName;
      const fileName = `${sourceName}.png`;
      const filePathOnDisk = path.join(imgFolder, fileName);
      if (fs.existsSync(filePathOnDisk)) {
        res.json({ preview: `/img/${fileName}` });
      } else {
        const previewData = await handleOBSCall(res, "GetSourceScreenshot", {
          sourceName,
          imageFormat: "png",
          imageWidth: 320,
          imageHeight: 180,
          imageCompressionQuality: 70,
        });
        res.json({ preview: previewData.imageData });
      }
    } catch (error) {
      res
        .status(500)
        .json({
          error: error.message,
          details: "Failed to get source preview",
        });
    }
  });

  router.post("/refresh-screenshots", async (req, res) => {
    try {
      if (!obsManager.isConnected) {
        return res.status(503).json({ error: "Not connected to OBS" });
      }
      const { scenes } = await handleOBSCall(res, "GetSceneList");
      const savedPaths = {};
      for (const scene of scenes) {
        try {
          const filePath = path.join(imgFolder, `${scene.sceneName}.png`);
          await handleOBSCall(res, "SaveSourceScreenshot", {
            sourceName: scene.sceneName,
            imageFormat: "png",
            imageFilePath: filePath,
            width: 1920,
            height: 1080,
          });
          savedPaths[scene.sceneName] = `/img/${scene.sceneName}.png`;
        } catch (error) {
          savedPaths[scene.sceneName] = null;
        }
      }
      res.json({ savedPaths });
    } catch (error) {
      res.status(500).json({ error: "Failed to refresh screenshots" });
    }
  });

  router.post("/set_position", async (req, res) => {
    const { sceneName, sceneItemId, x, y } = req.body;
    if (!sceneName || typeof sceneItemId !== "number") {
      return res.status(400).json({ error: "Missing required data" });
    }
    try {
      await handleOBSCall(res, "SetSceneItemTransform", {
        sceneName,
        sceneItemId,
        sceneItemTransform: { positionX: x, positionY: y },
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to set position" });
    }
  });

  router.post("/delete_source", async (req, res) => {
    const { sceneName, sourceId } = req.body;
    if (!sceneName || typeof sourceId !== "number") {
      return res.status(400).json({ error: "Missing or invalid parameters" });
    }
    try {
      await obsManager.call("RemoveSceneItem", {
        sceneName,
        sceneItemId: sourceId,
      });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete source" });
    }
  });

  router.post("/switch_scene", async (req, res) => {
    try {
      const { sceneName } = req.body;
      if (!sceneName) {
        return res
          .status(400)
          .json({
            error: "sceneName is required",
            details: "Please provide a sceneName in the request body",
          });
      }
      const { scenes } = await handleOBSCall(res, "GetSceneList");
      if (!scenes.some((scene) => scene.sceneName === sceneName)) {
        return res
          .status(404)
          .json({
            error: "Scene not found",
            details: `Scene \"${sceneName}\" does not exist in OBS`,
          });
      }
      await handleOBSCall(res, "SetCurrentProgramScene", { sceneName });
      res.json({
        status: "success",
        scene: sceneName,
        message: `Successfully switched to scene: ${sceneName}`,
      });
    } catch (error) {
      res
        .status(500)
        .json({ error: error.message, details: "Failed to switch scene" });
    }
  });

  router.post("/toggle_source", async (req, res) => {
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
      res.json({ status: "success", sceneName, sourceName, sourceId, visible });
    } catch (error) {
      res
        .status(500)
        .json({
          error: error.message,
          details: "Failed to toggle source visibility",
        });
    }
  });

  router.post("/streaming", async (req, res) => {
    try {
      const { action } = req.body;
      if (action !== "start" && action !== "stop") {
        return res.status(400).json({ error: "Invalid action" });
      }
      await handleOBSCall(
        res,
        action === "start" ? "StartStream" : "StopStream"
      );
      res.json({ status: "success", action });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/scene-previews", async (req, res) => {
    try {
      if (!obsManager.isConnected) {
        return res.status(503).json({ error: "Not connected to OBS" });
      }
      const { scenes } = await handleOBSCall(res, "GetSceneList");
      const savedPaths = {};
      for (const scene of scenes) {
        try {
          const filePath = path.join(imgFolder, `${scene.sceneName}.png`);
          await handleOBSCall(res, "SaveSourceScreenshot", {
            sourceName: scene.sceneName,
            imageFormat: "png",
            imageFilePath: filePath,
            width: 1920,
            height: 1080,
          });
          savedPaths[scene.sceneName] = filePath;
        } catch (error) {
          savedPaths[scene.sceneName] = null;
        }
      }
      res.json({ savedPaths });
    } catch (error) {
      res.status(500).json({ error: "Failed to save scene screenshots" });
    }
  });

  router.post("/toggle_mute", async (req, res) => {
    try {
      const { sceneName, sourceName, sourceId, muted } = req.body;
      await handleOBSCall(res, "SetInputMute", {
        inputName: sourceName,
        inputMuted: muted,
      });
      res.json({ status: "success", sceneName, sourceName, sourceId, muted });
    } catch (error) {
      res
        .status(500)
        .json({ error: error.message, details: "Failed to toggle mute" });
    }
  });

  router.post("/set_volume", async (req, res) => {
    try {
      const { sceneName, sourceName, sourceId, volume } = req.body;
      await handleOBSCall(res, "SetInputVolume", {
        inputName: sourceName,
        inputVolumeMul: volume,
      });
      res.json({ status: "success", sceneName, sourceName, sourceId, volume });
    } catch (error) {
      res
        .status(500)
        .json({ error: error.message, details: "Failed to set volume" });
    }
  });

  router.post("/recording", async (req, res) => {
    try {
      const { action } = req.body;
      if (action !== "start" && action !== "stop") {
        return res.status(400).json({ error: "Invalid action" });
      }
      await handleOBSCall(
        res,
        action === "start" ? "StartRecord" : "StopRecord"
      );
      res.json({ status: "success", action });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post("/add_source", async (req, res) => {
    const { sceneName, sourceName, inputKind, inputSettings = {} } = req.body;
    try {
      const result = await handleOBSCall(res, "CreateInput", {
        sceneName,
        inputName: sourceName,
        inputKind,
        inputSettings,
        sceneItemEnabled: true,
      });
      res.json({ status: "success", result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post("/move_source", async (req, res) => {
    const { sceneName, sourceId, x, y } = req.body;
    if (!sceneName || typeof sourceId !== "number" || isNaN(x) || isNaN(y)) {
      return res.status(400).json({ error: "Missing or invalid parameters" });
    }
    try {
      await handleOBSCall(res, "SetSceneItemTransform", {
        sceneName,
        sceneItemId: sourceId,
        sceneItemTransform: { positionX: x, positionY: y },
      });
      res.json({ success: true, moved: { sourceId, x, y } });
    } catch (err) {
      res
        .status(500)
        .json({ error: "Failed to move source", details: err.message });
    }
  });

  router.post("/verify-connection", async (req, res) => {
    const { ip, port, password } = req.body;
    const OBSWebSocket = require("obs-websocket-js").default;
    const obsTest = new OBSWebSocket();
    try {
      const url = `ws://${ip || config.host}:${port || config.port}`;
      await Promise.race([
        obsTest.connect(url, password || config.password),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Connection timeout")), 3000)
        ),
      ]);
      await obsTest.disconnect();
      res.json({ connected: true });
    } catch (error) {
      res.json({ connected: false, error: error.message });
    }
  });

  // Logs endpoint
  router.get("/logs", (req, res) => {
    const logPath = path.join(__dirname, "..", "logs", "server.log");
    fs.readFile(logPath, "utf8", (err, data) => {
      if (err) {
        return res.json({ logs: "No logs found or error reading log file." });
      }
      res.json({ logs: data });
    });
  });

  router.get("/export-config", async (req, res) => {
    try {
      const { scenes } = await handleOBSCall(res, "GetSceneList");
      const sceneConfigs = [];

      for (const scene of scenes) {
        const sceneName = scene.sceneName;
        if (!sceneName) continue;

        const { sceneItems } = await handleOBSCall(res, "GetSceneItemList", {
          sceneName: scene.sceneName,
        });

        const items = await Promise.all(
          sceneItems.map(async (item) => {
            const { sceneItemTransform } = await handleOBSCall(res, "GetSceneItemTransform", {
              sceneName: sceneName,
              sceneItemId: item.sceneItemId,
            });

            return {
              ...item,
              transform: sceneItemTransform,
            };
          })
        );

        sceneConfigs.push({
          sceneName,
          items,
        });
      }

      res.json({ exportedAt: new Date(), scenes: sceneConfigs});
    } catch (error) {
      console.error("Export Error:", error);
      res.status(500).json({ error: "Failed to export OBS config", details: error.message || 'Unknown error'});
    }
  })

  // --- End all routes ---
  return router;
};