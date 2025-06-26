class SceneController {
  constructor(obsService) {
    this.obs = obsService;
  }

  async getScenes(req, res) {
    try {
      const response = await this.obs.call("GetSceneList");

      if (!response?.scenes) {
        throw new Error("Invalid response from OBS");
      }

      const scenesWithPreviews = await Promise.all(
        response.scenes.map(async (scene) => {
          let preview = null;
          try {
            const previewData = await this.obs.call("GetSourceScreenshot", {
              sourceName: scene.sceneName,
              imageFormat: "jpeg",
              imageWidth: 320,
              imageHeight: 180,
              imageCompressionQuality: 70,
            });
            preview = previewData.imageData;
          } catch (e) {
            console.log(`Could not get preview for ${scene.sceneName}:`, e.message);
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
  }

  async switchScene(req, res) {
    try {
      const { sceneName } = req.body;
      if (!sceneName) {
        return res.status(400).json({
          error: "sceneName is required",
          details: "Please provide a sceneName in the request body",
        });
      }

      const { scenes } = await this.obs.call("GetSceneList");
      if (!scenes.some((scene) => scene.sceneName === sceneName)) {
        return res.status(404).json({
          error: "Scene not found",
          details: `Scene "${sceneName}" does not exist in OBS`,
        });
      }

      await this.obs.call("SetCurrentProgramScene", { sceneName });
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
  }

  async getScenePreviews(req, res) {
    try {
      if (!require('../utils/stateManager').isConnected) {
        return res.status(503).json({ error: "Not connected to OBS" });
      }

      const { scenes } = await this.obs.call("GetSceneList");
      const previews = {};

      for (const scene of scenes) {
        try {
          const { imageData } = await this.obs.call("GetSourceScreenshot", {
            sourceName: scene.sceneName,
            imageFormat: "png",
          });

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
  }
}

module.exports = SceneController;