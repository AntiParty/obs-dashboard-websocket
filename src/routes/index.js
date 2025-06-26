const express = require('express');
const router = express.Router();

module.exports = (obsService) => {
  const SystemController = require('../controllers/systemController');
  const SceneController = require('../controllers/sceneController');
  const SourceController = require('../controllers/sourceController');
  const AudioController = require('../controllers/audioController');
  const StreamController = require('../controllers/streamController');

  const systemController = new SystemController(obsService);
  const sceneController = new SceneController(obsService);
  const sourceController = new SourceController(obsService);
  const audioController = new AudioController(obsService);
  const streamController = new StreamController(obsService);

  // System routes
  router.get('/obs-status', systemController.getStatus.bind(systemController));
  router.get('/verify-connection', systemController.verifyConnection.bind(systemController));

  // Scene routes
  router.get('/scenes', sceneController.getScenes.bind(sceneController));
  router.post('/switch_scene', sceneController.switchScene.bind(sceneController));
  router.get('/scene-previews', sceneController.getScenePreviews.bind(sceneController));

  // Source routes
  router.get('/sources/:sceneName', sourceController.getSources.bind(sourceController));
  router.get('/source-preview/:sourceName', sourceController.getSourcePreview.bind(sourceController));
  router.post('/set_position', sourceController.setPosition.bind(sourceController));
  router.post('/delete_source', sourceController.deleteSource.bind(sourceController));
  router.post('/toggle_source', sourceController.toggleSource.bind(sourceController));
  router.post('/add_source', sourceController.addSource.bind(sourceController));
  router.post('/move_source', sourceController.moveSource.bind(sourceController));

  // Audio routes
  router.get('/audio-levels', audioController.getAudioLevels.bind(audioController));
  router.post('/toggle_mute', audioController.toggleMute.bind(audioController));
  router.post('/set_volume', audioController.setVolume.bind(audioController));

  // Stream/Recording routes
  router.post('/streaming', streamController.handleStreaming.bind(streamController));
  router.post('/recording', streamController.handleRecording.bind(streamController));

  return router;
};