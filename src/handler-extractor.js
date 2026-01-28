/**
 * Handler Extractor
 *
 * Extracts all event handlers, functions, and APIs from Windsurf's DOM
 * before we replace it with our custom UI.
 */

/**
 * Extract all handlers and functions from Windsurf Cascade
 * @returns {object} Extracted handlers and data
 */
function extract() {
  const extraction = {
    panels: [],
    handlers: {},
    elements: {},
    conversations: [],
    metadata: {}
  };

  // Extract panel data and conversation history
  const panels = document.querySelectorAll('.chat-client-root');

  if (!panels || panels.length === 0) {
    console.warn('No Cascade panels found');
    return extraction;
  }

  panels.forEach((panel, index) => {
    const input = panel.querySelector('[contenteditable="true"]');
    const sendButton = panel.querySelector('button.rounded-full');
    const scrollArea = panel.querySelector('.cascade-scrollbar');

    // Extract conversation content
    const conversationText = scrollArea?.innerText || '';
    const conversationHTML = scrollArea?.innerHTML || '';

    // Extract all message elements
    const messages = [...panel.querySelectorAll('[class*="message"], [class*="chat-message"]')]
      .map(msg => ({
        role: msg.classList.contains('user') || msg.getAttribute('role') === 'user' ? 'user' : 'assistant',
        content: msg.innerText,
        html: msg.innerHTML,
        timestamp: msg.dataset.timestamp || Date.now()
      }));

    // Store panel data
    extraction.panels.push({
      index,
      element: panel,
      input,
      sendButton,
      scrollArea,
      visible: panel.offsetWidth > 0 && panel.offsetHeight > 0,
      rect: panel.getBoundingClientRect()
    });

    // Store conversation
    extraction.conversations.push({
      index,
      messages,
      fullText: conversationText,
      fullHTML: conversationHTML,
      inputContent: input?.innerText || ''
    });

    // Extract event listeners from input
    if (input) {
      const listeners = getEventListeners(input);
      extraction.handlers[`panel_${index}_input`] = {
        input: listeners.input || [],
        keydown: listeners.keydown || [],
        keyup: listeners.keyup || [],
        focus: listeners.focus || [],
        blur: listeners.blur || []
      };
    }

    // Extract event listeners from send button
    if (sendButton) {
      const btnListeners = getEventListeners(sendButton);
      extraction.handlers[`panel_${index}_send`] = {
        click: btnListeners.click || [],
        mousedown: btnListeners.mousedown || []
      };
    }
  });

  // Extract Cascade panel toggle button
  const cascadeBtn = document.querySelector('[aria-label="Cascade (⌘L)"]');
  if (cascadeBtn) {
    extraction.elements.cascadeButton = cascadeBtn;
    extraction.handlers.cascadeToggle = getEventListeners(cascadeBtn);
  }

  // Extract command palette handlers
  const commandPalette = document.querySelector('.quick-input-widget');
  if (commandPalette) {
    extraction.elements.commandPalette = commandPalette;
    extraction.handlers.commandPalette = getEventListeners(commandPalette);
  }

  // Extract Monaco editor reference (for file editing)
  const monacoEditor = document.querySelector('.monaco-editor');
  if (monacoEditor) {
    extraction.elements.editor = monacoEditor;
    // Try to get the Monaco editor instance
    const editorInstance = monacoEditor.__zone_symbol__value ||
                          window.monaco?.editor?.getEditors?.()?.[0];
    extraction.metadata.monacoInstance = editorInstance;
  }

  // Extract workbench actions
  extraction.metadata.workbenchActions = extractWorkbenchActions();

  // Extract keyboard shortcuts
  extraction.metadata.shortcuts = extractKeyboardShortcuts();

  // Store references to key APIs
  extraction.metadata.apis = {
    monaco: window.monaco || null,
    vscode: window.vscode || null,
    cascadeAPI: findCascadeAPI()
  };

  return extraction;
}

/**
 * Helper: Get event listeners from an element
 * Uses Chrome DevTools API if available
 */
function getEventListeners(element) {
  if (!element) return {};

  // Try Chrome DevTools API first (won't be available via CDP evaluate)
  if (typeof window.getEventListeners === 'function') {
    try {
      return window.getEventListeners(element);
    } catch (e) {
      console.warn('getEventListeners failed:', e.message);
    }
  }

  // Fallback: Extract from element properties
  const listeners = {};
  try {
    for (const prop in element) {
      if (prop.startsWith('on') && typeof element[prop] === 'function') {
        const eventName = prop.slice(2);
        listeners[eventName] = [{ listener: element[prop] }];
      }
    }
  } catch (e) {
    console.warn('Failed to extract listeners:', e.message);
  }

  return listeners;
}

/**
 * Extract workbench actions (commands available in Windsurf)
 */
function extractWorkbenchActions() {
  const actions = {};

  // Try to access VSCode command registry
  try {
    const commandService = window.vscode?.commands ||
                          document.querySelector('[data-vscode-context]')?.__vscodeContext;

    if (commandService) {
      actions.available = true;
      actions.commandService = commandService;
    }
  } catch (e) {
    actions.error = e.message;
  }

  return actions;
}

/**
 * Extract keyboard shortcuts
 */
function extractKeyboardShortcuts() {
  const shortcuts = {
    cascade: {
      toggle: '⌘L',
      newTab: '⌘⇧I'
    },
    general: {
      commandPalette: 'F1',
      quickOpen: '⌘P'
    }
  };

  return shortcuts;
}

/**
 * Find Cascade API object in window scope
 */
function findCascadeAPI() {
  // Search for Cascade-related objects in window
  const keys = Object.keys(window).filter(k =>
    k.toLowerCase().includes('cascade') ||
    k.toLowerCase().includes('chat') ||
    k.toLowerCase().includes('ai')
  );

  const cascadeAPI = {};
  keys.forEach(key => {
    const obj = window[key];
    if (obj && typeof obj === 'object') {
      cascadeAPI[key] = obj;
    }
  });

  return cascadeAPI;
}

/**
 * Clone event handlers so they can be reused
 */
function cloneHandler(listener) {
  if (!listener || !listener.listener) return null;

  return {
    type: listener.type,
    useCapture: listener.useCapture,
    passive: listener.passive,
    once: listener.once,
    handler: listener.listener.bind(listener.listener.boundThis || null)
  };
}

/**
 * Wire extracted handlers to new elements
 */
function wireHandlers(extraction, customElements) {
  const wiredHandlers = [];

  extraction.panels.forEach((panel, index) => {
    const customPanel = customElements.panels[index];
    if (!customPanel) return;

    // Wire input handlers
    const inputHandlers = extraction.handlers[`panel_${index}_input`];
    if (inputHandlers && customPanel.input) {
      Object.entries(inputHandlers).forEach(([event, listeners]) => {
        listeners.forEach(listener => {
          const cloned = cloneHandler(listener);
          if (cloned) {
            customPanel.input.addEventListener(event, cloned.handler, {
              capture: cloned.useCapture,
              passive: cloned.passive,
              once: cloned.once
            });
            wiredHandlers.push({ element: customPanel.input, event, handler: cloned.handler });
          }
        });
      });
    }

    // Wire send button handlers
    const sendHandlers = extraction.handlers[`panel_${index}_send`];
    if (sendHandlers && customPanel.sendButton) {
      Object.entries(sendHandlers).forEach(([event, listeners]) => {
        listeners.forEach(listener => {
          const cloned = cloneHandler(listener);
          if (cloned) {
            customPanel.sendButton.addEventListener(event, cloned.handler, {
              capture: cloned.useCapture,
              passive: cloned.passive,
              once: cloned.once
            });
            wiredHandlers.push({ element: customPanel.sendButton, event, handler: cloned.handler });
          }
        });
      });
    }
  });

  return wiredHandlers;
}

module.exports = {
  extract,
  wireHandlers,
  cloneHandler
};
