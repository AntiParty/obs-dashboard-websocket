class StreamController {
  constructor(obsService) {
    this.obs = obsService;
  }

  async handleStreaming(req, res) {
    try {
      const { action } = req.body;
      
      if (action !== "start" && action !== "stop") {
        return res.status(400).json({ 
          error: "Invalid action",
          details: "Action must be either 'start' or 'stop'"
        });
      }

      const method = action === "start" ? "StartStream" : "StopStream";
      await this.obs.call(method);

      res.json({ 
        status: "success", 
        action,
        message: `Stream ${action === "start" ? "started" : "stopped"} successfully`
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        details: `Failed to ${req.body.action} stream`,
        action: req.body.action
      });
    }
  }

  async handleRecording(req, res) {
    try {
      const { action } = req.body;

      if (action !== "start" && action !== "stop") {
        return res.status(400).json({ 
          error: "Invalid action",
          details: "Action must be either 'start' or 'stop'"
        });
      }

      const method = action === "start" ? "StartRecord" : "StopRecord";
      await this.obs.call(method);

      res.json({ 
        status: "success", 
        action,
        message: `Recording ${action === "start" ? "started" : "stopped"} successfully`
      });
    } catch (error) {
      res.status(500).json({
        error: error.message,
        details: `Failed to ${req.body.action} recording`,
        action: req.body.action
      });
    }
  }

  async getStreamStatus() {
    try {
      const status = await this.obs.call("GetStreamStatus");
      return {
        streaming: status.outputActive,
        recording: status.outputActive,
        status
      };
    } catch (error) {
      console.error("Error getting stream status:", error);
      return {
        streaming: false,
        recording: false,
        error: error.message
      };
    }
  }
}

module.exports = StreamController;