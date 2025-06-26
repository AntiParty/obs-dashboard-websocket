class SourceController {
  constructor(obsService) {
    this.obs = obsService;
  }

  async getSources(req, res) {
    try {
      const { sceneName } = req.params;

      const [sceneList, groupList, inputs] = await Promise.all([
        this.obs.call("GetSceneList"),
        this.obs.call("GetGroupList"),
        this.obs.call("GetInputList")
      ]);

      const sceneNames = sceneList.scenes.map(scene => scene.sceneName);
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

      const itemsResponse = isGroup
        ? await this.obs.call("GetGroupSceneItemList", { sceneName })
        : await this.obs.call("GetSceneItemList", { sceneName });

      const [processedSources, audioSources] = await Promise.all([
        this.processSceneItems(itemsResponse.sceneItems, sceneName, isGroup),
        this.getAudioSources(inputs.inputs)
      ]);

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
  }

  async processSceneItems(sceneItems, sceneName, isGroup) {
    const processedSources = [];
    const groupPromises = [];

    for (const item of sceneItems) {
      if (item.parentGroupName) continue;

      if (item.isGroup || item.sourceType === "OBS_SOURCE_TYPE_GROUP") {
        groupPromises.push(
          this.processGroupItem(item, sceneName)
        );
      } else {
        processedSources.push(
          await this.processRegularItem(item, sceneName)
        );
      }
    }

    const groupResults = await Promise.all(groupPromises);
    return [...processedSources, ...groupResults];
  }

  async processGroupItem(item, sceneName) {
    try {
      const { sceneItems: groupItems } = await this.obs.call("GetGroupSceneItemList", {
        sceneName: item.sourceName,
      });

      return {
        id: item.sceneItemId,
        name: item.sourceName,
        type: "group",
        visible: item.sceneItemEnabled,
        items: groupItems.map(i => ({
          id: i.sceneItemId,
          name: i.sourceName,
          type: i.sourceType,
          visible: i.sceneItemEnabled,
          isGroupItem: true,
          parentGroup: item.sourceName,
        })),
      };
    } catch (error) {
      console.error(`Error processing group ${item.sourceName}:`, error);
      return {
        id: item.sceneItemId,
        name: item.sourceName,
        type: "group",
        visible: item.sceneItemEnabled,
        items: [],
        error: "Failed to load group contents",
      };
    }
  }

  async processRegularItem(item, sceneName) {
    let x = 0;
    let y = 0;

    try {
      const transform = await this.obs.call("GetSceneItemTransform", {
        sceneName,
        sceneItemId: item.sceneItemId,
      });
      x = transform.sceneItemTransform.positionX || 0;
      y = transform.sceneItemTransform.positionY || 0;
    } catch (err) {
      console.warn(`Could not get position for ${item.sourceName}:`, err.message);
    }

    return {
      id: item.sceneItemId,
      name: item.sourceName,
      type: item.sourceType,
      visible: item.sceneItemEnabled,
      x,
      y,
    };
  }

  async getAudioSources(inputs) {
    const audioSources = [];
    
    for (const input of inputs) {
      try {
        const inputInfo = await this.obs.call("GetInputAudioTracks", {
          inputName: input.inputName,
        }).catch(() => null);

        if (inputInfo) {
          const [volume, muted] = await Promise.all([
            this.obs.call("GetInputVolume", { inputName: input.inputName }),
            this.obs.call("GetInputMute", { inputName: input.inputName })
          ]);

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
        console.warn(`Skipping non-audio input "${input.inputName}":`, err.message);
      }
    }

    return audioSources;
  }

  async getSourcePreview(req, res) {
    try {
      const { sourceName } = req.params;
      const previewData = await this.obs.call("GetSourceScreenshot", {
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
  }

  async setPosition(req, res) {
    const { sceneName, sceneItemId, x, y } = req.body;

    if (!sceneName || typeof sceneItemId !== "number") {
      return res.status(400).json({ error: "Missing required data" });
    }

    try {
      await this.obs.call("SetSceneItemTransform", {
        sceneName,
        sceneItemId,
        sceneItemTransform: {
          positionX: x,
          positionY: y,
        },
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to set position:", error);
      res.status(500).json({ error: "Failed to set position" });
    }
  }

  async deleteSource(req, res) {
    const { sceneName, sourceId } = req.body;

    if (!sceneName || typeof sourceId !== "number") {
      return res.status(400).json({ error: "Missing or invalid parameters" });
    }

    try {
      await this.obs.call("RemoveSceneItem", {
        sceneName,
        sceneItemId: sourceId,
      });

      res.json({ success: true });
    } catch (err) {
      console.error("Failed to delete source:", err.message || err);
      res.status(500).json({ error: "Failed to delete source" });
    }
  }

  async toggleSource(req, res) {
    try {
      const { sceneName, sourceName, sourceId, visible } = req.body;
      if (!sceneName || !sourceName || typeof visible !== "boolean") {
        return res.status(400).json({ error: "Invalid parameters" });
      }

      await this.obs.call("SetSceneItemEnabled", {
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
  }

  async addSource(req, res) {
    const { sceneName, sourceName, inputKind, inputSettings = {} } = req.body;

    try {
      const result = await this.obs.call("CreateInput", {
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
  }

  async moveSource(req, res) {
    const { sceneName, sourceId, x, y } = req.body;

    if (!sceneName || typeof sourceId !== "number" || isNaN(x) || isNaN(y)) {
      return res.status(400).json({ error: "Missing or invalid parameters" });
    }

    try {
      await this.obs.call("SetSceneItemTransform", {
        sceneName,
        sceneItemId: sourceId,
        sceneItemTransform: {
          positionX: x,
          positionY: y,
        },
      });

      res.json({ success: true, moved: { sourceId, x, y } });
    } catch (err) {
      console.error("Failed to move source:", err.message || err);
      res.status(500).json({ 
        error: "Failed to move source", 
        details: err.message 
      });
    }
  }
}

module.exports = SourceController;