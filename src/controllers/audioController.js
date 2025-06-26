class AudioController {
  constructor(obsService) {
    this.obs = obsService;
  }

  async getAudioLevels(req, res) {
    try {
      const { inputs } = await this.obs.call("GetInputList");
      const levels = {};

      for (const input of inputs) {
        try {
          // Check if input has audio tracks
          await this.obs.call("GetInputAudioTracks", {
            inputName: input.inputName,
          });

          // Get audio levels if available
          const { inputLevels } = await this.obs.call(
            "GetInputAudioMonitor",
            { inputName: input.inputName }
          );
          levels[input.inputName] = inputLevels?.[0]?.[0] || 0;
        } catch (error) {
          // Skip non-audio inputs silently
          continue;
        }
      }

      res.json(levels);
    } catch (error) {
      res.json({});
    }
  }

  async toggleMute(req, res) {
    try {
      const { sourceName, muted } = req.body;

      await this.obs.call("SetInputMute", {
        inputName: sourceName,
        inputMuted: muted,
      });

      res.json({
        status: "success",
        sourceName,
        muted,
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        details: "Failed to toggle mute",
      });
    }
  }

  async setVolume(req, res) {
    try {
      const { sourceName, volume } = req.body;

      await this.obs.call("SetInputVolume", {
        inputName: sourceName,
        inputVolumeMul: volume,
      });

      res.json({
        status: "success",
        sourceName,
        volume,
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        details: "Failed to set volume",
      });
    }
  }

  async getAudioSources() {
    try {
      const { inputs } = await this.obs.call("GetInputList");
      const audioSources = [];

      for (const input of inputs) {
        try {
          const inputInfo = await this.obs.call("GetInputAudioTracks", {
            inputName: input.inputName,
          });

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
    } catch (error) {
      console.error("Error getting audio sources:", error);
      return [];
    }
  }
}

module.exports = AudioController;