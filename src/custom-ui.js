/**
 * Custom UI Shell
 *
 * Modern, clean interface that replaces Windsurf's Cascade UI
 * with full multi-agent support and Agent Hub.
 */

/**
 * Create the custom UI shell
 * @param {object} extraction - Extracted handlers from handler-extractor
 * @returns {object} Custom UI elements
 */
function createUI(extraction) {
  const customUI = {
    root: null,
    agentHub: null,
    panels: [],
    toolbar: null,
    metadata: {}
  };

  // Create root container
  const root = document.createElement('div');
  root.id = 'cascade-hub-ui';
  root.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 450px;
    height: 100vh;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    z-index: 999999;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #e0e0e0;
    box-shadow: -4px 0 24px rgba(0,0,0,0.5);
  `;
  customUI.root = root;

  // Create toolbar
  const toolbar = createToolbar(extraction);
  root.appendChild(toolbar);
  customUI.toolbar = toolbar;

  // Create Agent Hub
  const agentHub = createAgentHub(extraction);
  root.appendChild(agentHub);
  customUI.agentHub = agentHub;

  // Create panels container
  const panelsContainer = document.createElement('div');
  panelsContainer.id = 'panels-container';
  panelsContainer.style.cssText = `
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: rgba(0,0,0,0.2);
  `;
  root.appendChild(panelsContainer);

  // Create panels from extracted data
  if (extraction.conversations && extraction.conversations.length > 0) {
    extraction.conversations.forEach((conv, index) => {
      const panel = createPanel(conv, index, extraction);
      panelsContainer.appendChild(panel);
      customUI.panels.push(panel);
    });
  } else {
    // No panels found - show a placeholder
    const placeholder = document.createElement('div');
    placeholder.style.cssText = `
      padding: 32px;
      text-align: center;
      color: #666;
      font-size: 14px;
    `;
    placeholder.textContent = 'No Cascade panels found. Click "+ New" to create one.';
    panelsContainer.appendChild(placeholder);
  }

  // Add global styles
  injectStyles();

  return customUI;
}

/**
 * Create toolbar with controls
 */
function createToolbar(extraction) {
  const toolbar = document.createElement('div');
  toolbar.id = 'cascade-toolbar';
  toolbar.style.cssText = `
    height: 56px;
    background: rgba(0,0,0,0.3);
    border-bottom: 1px solid rgba(255,255,255,0.1);
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 12px;
    flex-shrink: 0;
  `;

  // Title
  const title = document.createElement('div');
  title.textContent = 'Cascade Hub';
  title.style.cssText = `
    font-size: 18px;
    font-weight: 600;
    color: #00d4ff;
    flex: 1;
    letter-spacing: 0.5px;
  `;
  toolbar.appendChild(title);

  // Panel count badge
  const badge = document.createElement('div');
  badge.id = 'panel-count-badge';
  badge.textContent = extraction.conversations.length;
  badge.style.cssText = `
    background: #00d4ff;
    color: #1a1a2e;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 700;
  `;
  toolbar.appendChild(badge);

  // New panel button
  const newBtn = createButton('+ New', () => {
    window.dispatchEvent(new CustomEvent('cascade-spawn-panel'));
  });
  toolbar.appendChild(newBtn);

  // Close button
  const closeBtn = createButton('✕', () => {
    document.getElementById('cascade-hub-ui')?.remove();
    restoreOriginalUI();
  }, 'danger');
  toolbar.appendChild(closeBtn);

  return toolbar;
}

/**
 * Create Agent Hub panel
 */
function createAgentHub(extraction) {
  const hub = document.createElement('div');
  hub.id = 'agent-hub';
  hub.style.cssText = `
    background: rgba(0,0,0,0.3);
    border-bottom: 1px solid rgba(255,255,255,0.1);
    padding: 16px;
    flex-shrink: 0;
  `;

  const hubTitle = document.createElement('div');
  hubTitle.textContent = '⚡ Agent Hub';
  hubTitle.style.cssText = `
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 12px;
    color: #00d4ff;
  `;
  hub.appendChild(hubTitle);

  // Agent slots
  const slots = document.createElement('div');
  slots.style.cssText = `
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  `;

  const agents = [
    { name: 'Scout', emoji: '🔍', status: 'active' },
    { name: 'Builder', emoji: '🔨', status: 'idle' },
    { name: 'Reviewer', emoji: '✅', status: 'idle' },
    { name: 'Debugger', emoji: '🐛', status: 'idle' },
    { name: 'Optimizer', emoji: '⚡', status: 'idle' },
    { name: 'Tester', emoji: '🧪', status: 'idle' }
  ];

  agents.forEach(agent => {
    const slot = document.createElement('div');
    slot.className = 'agent-slot';
    slot.dataset.status = agent.status;
    slot.style.cssText = `
      background: ${agent.status === 'active' ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.05)'};
      border: 1px solid ${agent.status === 'active' ? '#00d4ff' : 'rgba(255,255,255,0.1)'};
      border-radius: 8px;
      padding: 8px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
    `;

    const emoji = document.createElement('div');
    emoji.textContent = agent.emoji;
    emoji.style.cssText = 'font-size: 20px; margin-bottom: 4px;';
    slot.appendChild(emoji);

    const name = document.createElement('div');
    name.textContent = agent.name;
    name.style.cssText = `
      font-size: 11px;
      font-weight: 500;
      color: ${agent.status === 'active' ? '#00d4ff' : '#888'};
    `;
    slot.appendChild(name);

    slot.addEventListener('mouseenter', () => {
      slot.style.transform = 'scale(1.05)';
      slot.style.borderColor = '#00d4ff';
    });

    slot.addEventListener('mouseleave', () => {
      slot.style.transform = 'scale(1)';
      slot.style.borderColor = agent.status === 'active' ? '#00d4ff' : 'rgba(255,255,255,0.1)';
    });

    slot.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('cascade-agent-toggle', {
        detail: { agent: agent.name }
      }));
    });

    slots.appendChild(slot);
  });

  hub.appendChild(slots);
  return hub;
}

/**
 * Create a Cascade panel
 */
function createPanel(conversation, index, extraction) {
  const panel = document.createElement('div');
  panel.className = 'cascade-panel';
  panel.dataset.index = index;
  panel.style.cssText = `
    background: rgba(0,0,0,0.2);
    display: flex;
    flex-direction: column;
    height: 400px;
    flex-shrink: 0;
  `;

  // Panel header
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 8px 12px;
    background: rgba(0,0,0,0.3);
    border-bottom: 1px solid rgba(255,255,255,0.1);
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  `;

  const panelTitle = document.createElement('div');
  panelTitle.textContent = `Panel ${index}`;
  panelTitle.style.cssText = `
    flex: 1;
    font-size: 12px;
    font-weight: 600;
    color: #888;
  `;
  header.appendChild(panelTitle);

  const expandBtn = createButton('↕', () => {
    const current = panel.style.height;
    panel.style.height = current === '400px' ? '600px' : '400px';
  }, 'small');
  header.appendChild(expandBtn);

  panel.appendChild(header);

  // Conversation area
  const conversationArea = document.createElement('div');
  conversationArea.className = 'conversation-area';
  conversationArea.style.cssText = `
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    font-size: 13px;
    line-height: 1.6;
  `;

  // Restore conversation messages (using textContent for security)
  if (conversation.messages && conversation.messages.length > 0) {
    conversation.messages.forEach(msg => {
      const msgEl = document.createElement('div');
      msgEl.style.cssText = `
        margin-bottom: 16px;
        padding: 10px 12px;
        border-radius: 8px;
        background: ${msg.role === 'user' ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.05)'};
        border-left: 3px solid ${msg.role === 'user' ? '#00d4ff' : '#888'};
      `;
      msgEl.textContent = msg.content;
      conversationArea.appendChild(msgEl);
    });
  } else {
    // Empty conversation
    const emptyMsg = document.createElement('div');
    emptyMsg.style.cssText = `
      padding: 20px;
      text-align: center;
      color: #666;
      font-size: 13px;
      font-style: italic;
    `;
    emptyMsg.textContent = 'No messages yet. Start a conversation below.';
    conversationArea.appendChild(emptyMsg);
  }

  panel.appendChild(conversationArea);

  // Input area
  const inputContainer = document.createElement('div');
  inputContainer.style.cssText = `
    padding: 12px;
    background: rgba(0,0,0,0.3);
    border-top: 1px solid rgba(255,255,255,0.1);
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  `;

  const input = document.createElement('div');
  input.contentEditable = true;
  input.className = 'cascade-input';
  input.dataset.panelIndex = index;
  input.textContent = conversation.inputContent;
  input.style.cssText = `
    flex: 1;
    min-height: 40px;
    max-height: 120px;
    overflow-y: auto;
    padding: 10px 12px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    color: #e0e0e0;
    outline: none;
    font-size: 13px;
    line-height: 1.5;
  `;

  input.addEventListener('focus', () => {
    input.style.borderColor = '#00d4ff';
    input.style.background = 'rgba(0,212,255,0.05)';
  });

  input.addEventListener('blur', () => {
    input.style.borderColor = 'rgba(255,255,255,0.1)';
    input.style.background = 'rgba(255,255,255,0.05)';
  });

  inputContainer.appendChild(input);

  const sendButton = createButton('Send', () => {
    const message = input.innerText.trim();
    if (message) {
      window.dispatchEvent(new CustomEvent('cascade-send', {
        detail: { panelIndex: index, message }
      }));
      input.innerText = '';
    }
  }, 'primary');
  sendButton.className = 'cascade-send-button';
  sendButton.dataset.panelIndex = index;
  inputContainer.appendChild(sendButton);

  panel.appendChild(inputContainer);

  // Store references
  panel._cascadeRefs = {
    input,
    sendButton,
    conversationArea,
    originalPanel: extraction.panels?.[index]?.element || null
  };

  return panel;
}

/**
 * Create a styled button
 */
function createButton(text, onClick, variant = 'default') {
  const btn = document.createElement('button');
  btn.textContent = text;
  btn.onclick = onClick;

  const variants = {
    default: 'background: rgba(255,255,255,0.1); color: #e0e0e0;',
    primary: 'background: #00d4ff; color: #1a1a2e;',
    danger: 'background: rgba(255,80,80,0.2); color: #ff5050;',
    small: 'background: rgba(255,255,255,0.05); color: #888; padding: 4px 8px; font-size: 11px;'
  };

  btn.style.cssText = `
    ${variants[variant]}
    border: none;
    border-radius: 6px;
    padding: 8px 16px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    outline: none;
  `;

  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'scale(1.05)';
    btn.style.opacity = '0.9';
  });

  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'scale(1)';
    btn.style.opacity = '1';
  });

  return btn;
}

/**
 * Inject global styles
 */
function injectStyles() {
  const styleId = 'cascade-mount-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    #cascade-hub-ui * {
      box-sizing: border-box;
    }

    #cascade-hub-ui ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    #cascade-hub-ui ::-webkit-scrollbar-track {
      background: rgba(0,0,0,0.2);
    }

    #cascade-hub-ui ::-webkit-scrollbar-thumb {
      background: rgba(0,212,255,0.3);
      border-radius: 4px;
    }

    #cascade-hub-ui ::-webkit-scrollbar-thumb:hover {
      background: rgba(0,212,255,0.5);
    }

    .cascade-input:empty:before {
      content: 'Type a message...';
      color: #666;
    }
  `;

  document.head.appendChild(style);
}

/**
 * Mount the custom UI to the DOM
 */
function mount(customUI) {
  // Remove any existing custom UIs first (cleanup duplicates)
  const existingUIs = document.querySelectorAll('#cascade-hub-ui');
  existingUIs.forEach(ui => ui.remove());
  
  // Stop any existing observer
  stopObserver();
  
  document.body.appendChild(customUI.root);
  
  // Store reference for dynamic panel adding
  setCustomUIRef(customUI);
  
  // Force resize to fix initial render sizing issues
  setTimeout(() => {
    window.dispatchEvent(new Event('resize'));
  }, 100);
  
  return customUI;
}

/**
 * Destroy original Windsurf UI elements and watch for new ones
 */
let panelObserver = null;
let customUIRef = null;
let panelCount = 0;

// Store reference to custom UI for dynamic panel adding
function setCustomUIRef(ui) {
  customUIRef = ui;
  panelCount = ui.panels?.length || 0;
}

// Extract content from a native Cascade panel
function extractPanelContent(nativePanel) {
  const messages = [];
  const messageEls = nativePanel.querySelectorAll('[class*="message"], [class*="Message"], .prose, [class*="markdown"]');
  messageEls.forEach(el => {
    const text = el.innerText?.trim();
    if (text && text.length > 0) {
      messages.push({
        role: el.closest('[class*="user"]') ? 'user' : 'assistant',
        content: text.substring(0, 500) // Limit length
      });
    }
  });
  
  // Get input content
  const input = nativePanel.querySelector('[contenteditable="true"], textarea, input');
  const inputContent = input?.innerText || input?.value || '';
  
  return {
    messages,
    inputContent,
    timestamp: Date.now()
  };
}

// Add a new panel to our custom UI
function addPanelToUI(nativePanel) {
  console.log('[Cascade Hub] addPanelToUI called');
  
  if (!customUIRef) {
    console.log('[Cascade Hub] ERROR: customUIRef is null');
    return false;
  }
  
  const container = document.getElementById('panels-container');
  if (!container) {
    console.log('[Cascade Hub] ERROR: panels-container not found');
    return false;
  }
  
  try {
    // Extract content from native panel
    const conversation = extractPanelContent(nativePanel);
    console.log('[Cascade Hub] Extracted conversation:', conversation.messages?.length || 0, 'messages');
    
    // Create new panel
    const newIndex = panelCount++;
    const panel = createPanel(conversation, newIndex, {});
    console.log('[Cascade Hub] Created panel element');
    
    // Add to container
    container.appendChild(panel);
    customUIRef.panels.push(panel);
    console.log('[Cascade Hub] Appended to container, total panels:', container.children.length);
    
    // Update badge
    const badge = document.getElementById('panel-count-badge');
    if (badge) {
      badge.textContent = panelCount;
      console.log('[Cascade Hub] Updated badge to:', panelCount);
    }
    
    console.log(`[Cascade Hub] Successfully added panel ${newIndex}`);
    return true;
  } catch (err) {
    console.log('[Cascade Hub] ERROR in addPanelToUI:', err.message);
    return false;
  }
}

// Hide an element
function hideElement(el) {
  if (el && el.style.display !== 'none') {
    el.style.display = 'none';
    return true;
  }
  return false;
}

function destroyOriginalUI() {
  let hiddenCount = 0;
  
  // Hide Cascade tabs in tab bar
  const hideCascadeTabs = () => {
    const allTabs = document.querySelectorAll('.tab, [role="tab"]');
    allTabs.forEach(t => {
      if (t.innerText?.includes('Cascade')) {
        if (hideElement(t)) hiddenCount++;
      }
    });
  };
  
  // Hide existing Cascade chat panels (already extracted during createUI)
  const panels = document.querySelectorAll('.chat-client-root');
  panels.forEach(panel => {
    if (hideElement(panel)) hiddenCount++;
  });
  
  // Hide the auxiliary bar that contains Cascade (right panel)
  const auxBar = document.getElementById('workbench.parts.auxiliarybar');
  if (hideElement(auxBar)) hiddenCount++;
  
  // Hide Cascade tabs
  hideCascadeTabs();

  // Watch for new panels and tabs being added
  if (!panelObserver) {
    // Track which panels we've already processed
    const processedPanels = new Set();
    
    panelObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1) { // Element node
            
            // Check if it's a new chat panel
            if (node.classList?.contains('chat-client-root')) {
              if (!processedPanels.has(node)) {
                processedPanels.add(node);
                console.log('[Cascade Hub] New panel detected via MutationObserver');
                // Small delay to let content render
                setTimeout(() => {
                  addPanelToUI(node);
                  hideElement(node);
                }, 100);
              }
            }
            
            // Check children for chat panels
            const childPanels = node.querySelectorAll?.('.chat-client-root');
            childPanels?.forEach(panel => {
              if (!processedPanels.has(panel)) {
                processedPanels.add(panel);
                console.log('[Cascade Hub] New child panel detected');
                setTimeout(() => {
                  addPanelToUI(panel);
                  hideElement(panel);
                }, 100);
              }
            });
            
            // Check if it's a Cascade tab
            if ((node.classList?.contains('tab') || node.getAttribute?.('role') === 'tab') 
                && node.innerText?.includes('Cascade')) {
              hideElement(node);
            }
            
            // Check children for Cascade tabs
            const childTabs = node.querySelectorAll?.('.tab, [role="tab"]');
            childTabs?.forEach(tab => {
              if (tab.innerText?.includes('Cascade')) {
                hideElement(tab);
              }
            });
          }
        });
      });
    });
    
    panelObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log('[Cascade Hub] MutationObserver started');
  }

  return { hidden: hiddenCount };
}

function stopObserver() {
  if (panelObserver) {
    panelObserver.disconnect();
    panelObserver = null;
  }
}

/**
 * Restore original UI (for cleanup)
 */
function restoreOriginalUI() {
  // Stop watching for new panels
  stopObserver();
  
  // Restore Cascade panels
  const panels = document.querySelectorAll('.chat-client-root');
  panels.forEach(panel => {
    panel.style.display = '';
  });

  // Restore auxiliary bar
  const auxBar = document.getElementById('workbench.parts.auxiliarybar');
  if (auxBar) {
    auxBar.style.display = '';
  }
  
  // Remove our UI
  const ourUI = document.getElementById('cascade-hub-ui');
  if (ourUI) {
    ourUI.remove();
  }
}

module.exports = {
  createUI,
  mount,
  destroyOriginalUI,
  restoreOriginalUI,
  stopObserver,
  setCustomUIRef,
  addPanelToUI
};
