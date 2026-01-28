/**
 * Cascade Multiagent - Programmatic API
 *
 * Clean interface for CDP-based Windsurf automation with DOM mounting.
 *
 * Usage:
 *   const cascade = require('cascade-multiagent');
 *   await cascade.connect(9333);
 *   await cascade.mountCustomUI();
 *   await cascade.send(0, 'Hello!');
 *   const response = await cascade.getResponse(0);
 *   await cascade.restoreUI();
 *   await cascade.disconnect();
 */

const cascadeController = require('./src/cascade-controller');

// Re-export all functions from cascade-controller
module.exports = {
  // Connection management
  connect: cascadeController.connect,
  disconnect: cascadeController.disconnect,

  // Workspace setup
  trustWorkspace: cascadeController.trustWorkspace,

  // Panel management
  open: cascadeController.open,
  listPanels: cascadeController.listPanels,
  getPanelState: cascadeController.getPanelState,
  spawnCascade: cascadeController.spawnCascade,

  // Messaging
  send: cascadeController.send,
  getResponse: cascadeController.getResponse,

  // UI Hijacking
  mountCustomUI: cascadeController.mountCustomUI,
  getMountStatus: cascadeController.getMountStatus,
  restoreUI: cascadeController.restoreUI
};
