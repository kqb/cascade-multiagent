/**
 * Cascade Controller CDP Controller with DOM Mounting
 *
 * Silent automation of Windsurf Cascade panels via Chrome DevTools Protocol.
 * Now includes DOM mounting for custom UI with Agent Hub.
 *
 * Usage:
 *   const cascade = require('./cascade-controller');
 *   await cascade.connect(9333);
 *   await cascade.mountCustomUI();  // Replace Windsurf UI with custom interface
 *   await cascade.send(0, 'Hello Cascade!');
 *   const response = await cascade.getResponse(0);
 */

const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

let browser = null;
let page = null;
let cdpClient = null;
let mountedUI = null;

/**
 * Connect to Windsurf via CDP
 * @param {number} port - CDP port (default 9333)
 */
async function connect(port = 9333) {
  browser = await puppeteer.connect({
    browserURL: `http://localhost:${port}`
  });
  const pages = await browser.pages();
  page = pages[0]; // Main workbench page
  cdpClient = await page.target().createCDPSession();
  
  return { connected: true, pageTitle: await page.title() };
}

/**
 * Disconnect from CDP
 */
async function disconnect() {
  if (browser) {
    await browser.disconnect();
    browser = null;
    page = null;
    cdpClient = null;
  }
}

/**
 * Dismiss workspace trust dialog if present
 */
async function trustWorkspace() {
  const result = await page.evaluate(() => {
    const buttons = document.querySelectorAll('.dialog-buttons button, .monaco-dialog-box button, button');
    for (const btn of buttons) {
      if (btn.innerText.includes('Yes, I trust')) {
        btn.click();
        return { dismissed: true, text: btn.innerText };
      }
    }
    return { dismissed: false, noDialog: true };
  });
  
  if (result.dismissed) {
    await sleep(500);
  }
  
  return result;
}

/**
 * Open Cascade panel (click the Cascade button)
 */
async function open() {
  const result = await page.evaluate(() => {
    const btn = document.querySelector('[aria-label="Cascade (⌘L)"]');
    if (btn) {
      btn.click();
      return { opened: true };
    }
    return { opened: false, error: 'Cascade button not found' };
  });
  
  await sleep(1000);
  return result;
}

/**
 * Get panel state
 * @param {number} index - Panel index (0 = OG sidebar panel)
 */
async function getPanelState(index = 0) {
  return page.evaluate((idx) => {
    const panels = document.querySelectorAll('.chat-client-root');
    const panel = panels[idx];
    if (!panel) return { error: `Panel ${idx} not found`, totalPanels: panels.length };
    
    const rect = panel.getBoundingClientRect();
    const input = panel.querySelector('[contenteditable="true"]');
    const btn = panel.querySelector('button.rounded-full');
    
    return {
      index: idx,
      visible: rect.width > 0 && rect.height > 0,
      inputContent: input?.innerText || '',
      buttonEnabled: btn ? !btn.className.includes('cursor-not-allowed') : false,
      totalPanels: panels.length
    };
  }, index);
}

/**
 * Send a message to a Cascade panel
 * @param {number} index - Panel index
 * @param {string} message - Message to send
 * @param {object} options - { clear: true, submit: true }
 */
async function send(index, message, options = {}) {
  const { clear = true, submit = true } = options;
  
  // Robustly focus the input - click panel first, then input, then focus
  const focusResult = await page.evaluate((idx) => {
    const panels = document.querySelectorAll('.chat-client-root');
    const panel = panels[idx];
    if (!panel) return { error: 'Panel not found' };
    
    const input = panel.querySelector('[contenteditable="true"]');
    if (!input) return { error: 'Input not found' };
    
    // Click the panel to activate it
    panel.click();
    
    // Scroll input into view
    input.scrollIntoView({ block: 'center' });
    
    // Multiple focus attempts
    input.click();
    input.focus();
    
    // Verify focus
    const isFocused = document.activeElement === input || 
                      input.contains(document.activeElement);
    
    return { focused: isFocused, panelIndex: idx };
  }, index);
  
  if (focusResult.error) {
    return { sent: false, error: focusResult.error };
  }
  
  await sleep(200);
  
  // Clear existing content if requested
  if (clear) {
    // Cmd+A to select all
    await cdpClient.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Meta', modifiers: 8 });
    await cdpClient.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', modifiers: 8 });
    await cdpClient.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a' });
    await cdpClient.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Meta' });
    await sleep(50);
    
    // Backspace to delete
    await cdpClient.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace' });
    await cdpClient.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace' });
    await sleep(100);
  }
  
  // Type message character by character
  for (const char of message) {
    await cdpClient.send('Input.dispatchKeyEvent', { type: 'char', text: char });
    await sleep(15); // Small delay for Lexical to process
  }
  
  await sleep(200);
  
  // Check button state
  const state = await getPanelState(index);
  
  if (submit && state.buttonEnabled) {
    // Click send button
    await page.evaluate((idx) => {
      const panels = document.querySelectorAll('.chat-client-root');
      const btn = panels[idx]?.querySelector('button.rounded-full:not(.cursor-not-allowed)');
      btn?.click();
    }, index);
    
    return { sent: true, message };
  }
  
  return { sent: false, buttonEnabled: state.buttonEnabled, inputContent: state.inputContent };
}

/**
 * Get the latest response from a Cascade panel
 * @param {number} index - Panel index
 * @param {number} waitMs - Max time to wait for response
 */
async function getResponse(index, waitMs = 10000) {
  const startTime = Date.now();
  let lastContent = '';
  
  while (Date.now() - startTime < waitMs) {
    const content = await page.evaluate((idx) => {
      const panels = document.querySelectorAll('.chat-client-root');
      const panel = panels[idx];
      const scrollArea = panel?.querySelector('.cascade-scrollbar');
      return scrollArea?.innerText || '';
    }, index);
    
    // Check if content is still changing (Cascade is typing)
    if (content !== lastContent) {
      lastContent = content;
      await sleep(500);
      continue;
    }
    
    // Content stable, return it
    if (content) {
      return { response: content, stable: true };
    }
    
    await sleep(200);
  }
  
  return { response: lastContent, timeout: true };
}

/**
 * Spawn a new Cascade panel via command palette
 * Note: ⌘⇧I doesn't work via CDP, but command palette does
 */
async function spawnCascade() {
  // Get panel count before
  const beforeCount = await page.evaluate(() => 
    document.querySelectorAll('.chat-client-root').length
  );
  
  // First, close any open dialogs/palettes with Escape
  await cdpClient.send('Input.dispatchKeyEvent', { 
    type: 'keyDown', key: 'Escape', code: 'Escape' 
  });
  await cdpClient.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape' });
  await sleep(300);
  
  // Open command palette with F1
  await cdpClient.send('Input.dispatchKeyEvent', { 
    type: 'keyDown', key: 'F1', code: 'F1', windowsVirtualKeyCode: 112 
  });
  await cdpClient.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'F1' });
  await sleep(500);
  
  // Type the command to spawn new Cascade tab
  await cdpClient.send('Input.insertText', { text: 'Cascade in new tab' });
  await sleep(500);
  
  // Press Enter to execute
  await cdpClient.send('Input.dispatchKeyEvent', { 
    type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 
  });
  await cdpClient.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter' });
  
  await sleep(2000);
  
  // Get panel count after
  const afterCount = await page.evaluate(() => 
    document.querySelectorAll('.chat-client-root').length
  );
  
  // New panels appear at index 0, pushing others down
  return { 
    spawned: afterCount > beforeCount,
    beforeCount,
    afterCount,
    newIndex: 0  // Spawned panel is always index 0
  };
}

/**
 * List all Cascade panels
 */
async function listPanels() {
  return page.evaluate(() => {
    const panels = document.querySelectorAll('.chat-client-root');
    return [...panels].map((panel, i) => {
      const rect = panel.getBoundingClientRect();
      const input = panel.querySelector('[contenteditable="true"]');
      const btn = panel.querySelector('button.rounded-full');
      return {
        index: i,
        id: panel.id || null,
        visible: rect.width > 0 && rect.height > 0,
        inputContent: input?.innerText?.slice(0, 50) || '',
        buttonEnabled: btn ? !btn.className.includes('cursor-not-allowed') : false
      };
    });
  });
}

/**
 * Mount Windsurf UI and replace with custom interface
 * Extracts handlers, creates custom UI, preserves conversations
 */
async function mountCustomUI() {
  if (!page) {
    throw new Error('Not connected. Call connect() first.');
  }

  // Load module code from files
  const extractorPath = path.join(__dirname, 'handler-extractor.js');
  const customUIPath = path.join(__dirname, 'custom-ui.js');
  const extractorCode = fs.readFileSync(extractorPath, 'utf8');
  const customUICode = fs.readFileSync(customUIPath, 'utf8');

  // Execute mounting directly via evaluate() to bypass Trusted Types
  // Note: Using Function constructor here is necessary to execute module code
  // in the browser context. The code is from controlled local files, not user input.
  const result = await page.evaluate((extractorSrc, customUISrc) => {
    try {
      // Create isolated scope to avoid module conflicts
      const runModule = (code) => {
        const module = { exports: {} };
        // Execute module code with Function constructor
        const moduleFunc = new Function('module', 'exports', code);
        moduleFunc(module, module.exports);
        return module.exports;
      };

      // Load modules
      console.log('Loading extractor module...');
      const extractor = runModule(extractorSrc);
      console.log('Extractor loaded:', typeof extractor.extract);

      console.log('Loading custom UI module...');
      const customUI = runModule(customUISrc);
      console.log('Custom UI loaded:', typeof customUI.createUI);

      // Step 1: Extract handlers and data
      console.log('Extracting handlers...');
      const extraction = extractor.extract();
      console.log('Extraction result:', {
        panels: extraction.panels?.length || 0,
        conversations: extraction.conversations?.length || 0,
        handlers: Object.keys(extraction.handlers || {}).length
      });

      // Step 2: Create custom UI
      console.log('Creating custom UI...');
      const ui = customUI.createUI(extraction);
      console.log('UI created');

      // Step 3: Mount custom UI
      console.log('Mounting custom UI...');
      customUI.mount(ui);
      console.log('UI mounted');

      // Step 4: Wire handlers
      console.log('Wiring handlers...');
      const wired = extractor.wireHandlers(extraction, ui);
      console.log('Handlers wired:', wired.length);

      // Step 5: Destroy original UI
      console.log('Destroying original UI...');
      const destroyed = customUI.destroyOriginalUI();
      console.log('Original UI destroyed:', destroyed.hidden);

      return {
        success: true,
        extraction: {
          panelCount: extraction.panels?.length || 0,
          conversationCount: extraction.conversations?.length || 0,
          handlersExtracted: Object.keys(extraction.handlers || {}).length
        },
        wired: wired.length,
        destroyed: destroyed.hidden,
        ui: {
          mounted: !!document.getElementById('cascade-hub-ui')
        }
      };
    } catch (error) {
      console.error('Mount error:', error);
      return {
        success: false,
        error: error.message,
        stack: error.stack
      };
    }
  }, extractorCode, customUICode);

  // Check for errors
  if (!result.success) {
    throw new Error(`Mount failed: ${result.error}\n${result.stack}`);
  }

  mountedUI = result;

  // Set up event bridges for custom UI
  await setupEventBridges();

  return result;
}

/**
 * Setup event bridges between custom UI and CDP backend
 */
async function setupEventBridges() {
  // Listen for custom UI events and bridge them to CDP actions
  await page.exposeFunction('cascadeSendMessage', async (panelIndex, message) => {
    return await send(panelIndex, message);
  });

  await page.exposeFunction('cascadeSpawnPanel', async () => {
    return await spawnCascade();
  });

  // Install event listeners in page
  await page.evaluate(() => {
    // Bridge cascade-send event
    window.addEventListener('cascade-send', async (e) => {
      const { panelIndex, message } = e.detail;
      await window.cascadeSendMessage(panelIndex, message);
    });

    // Bridge cascade-spawn-panel event
    window.addEventListener('cascade-spawn-panel', async () => {
      const result = await window.cascadeSpawnPanel();
      if (result.spawned) {
        // Refresh UI to show new panel
        window.location.reload();
      }
    });

    // Bridge cascade-agent-toggle event
    window.addEventListener('cascade-agent-toggle', (e) => {
      const { agent } = e.detail;
      console.log('Agent toggled:', agent);
      // TODO: Implement agent orchestration
    });
  });
}

/**
 * Get mounted UI status
 */
function getMountStatus() {
  return mountedUI;
}

/**
 * Restore original Windsurf UI
 */
async function restoreUI() {
  if (!page || !mountedUI) {
    return { restored: false, error: 'UI not mounted' };
  }

  const result = await page.evaluate(() => {
    const customUIRoot = document.getElementById('cascade-hub-ui');
    if (customUIRoot) {
      customUIRoot.remove();
    }

    // Show original panels
    const panels = document.querySelectorAll('.chat-client-root');
    panels.forEach(panel => {
      panel.style.display = '';
    });

    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
      sidebar.style.display = '';
    }

    return { restored: true };
  });

  mountedUI = null;
  return result;
}

// Helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  connect,
  disconnect,
  trustWorkspace,
  open,
  getPanelState,
  send,
  getResponse,
  spawnCascade,
  listPanels,
  // New mounting API
  mountCustomUI,
  getMountStatus,
  restoreUI
};
