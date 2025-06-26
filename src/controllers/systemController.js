class SystemController {
  constructor(obsService) {
    this.obs = obsService;
  }

  async getStatus(req, res) {
    try {
      const status = await this.obs.call("GetStreamStatus");
      res.json({
        connected: true,
        streaming: status.outputActive,
        recording: status.outputActive,
      });
    } catch (error) {
      res.json({ connected: false, error: error.message });
    }
  }

  async verifyConnection(req, res) {
    try {
      await this.obs.call("GetVersion");
      res.json({ connected: true });
    } catch (error) {
      res.json({ connected: false, error: error.message });
    }
  }
}

module.exports = SystemController;