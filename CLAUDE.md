# Cascade Multiagent - Agent Instructions

## Project Overview

This project implements **CDP-based DOM mounting** for Windsurf's Cascade AI assistant interface. It enables:

- Silent automation of Windsurf Cascade panels via Chrome DevTools Protocol (CDP)
- Replacement of Windsurf's native UI with a custom multi-agent interface
- Full preservation of conversation history and event handlers
- Agent Hub for coordinating multiple AI agents

**Core Innovation**: Extract event handlers from the original DOM before replacement, then wire them to custom UI elements. This preserves all Windsurf functionality while providing a completely custom interface.

## Architecture

The system operates in three phases:

### Phase 1: Connection & Extraction
1. Connect to Windsurf via CDP (puppeteer-core)
2. Extract all event handlers, conversation data, and references from existing Cascade panels
3. Preserve full conversation history and metadata

### Phase 2: UI Replacement
1. Create custom UI shell with Agent Hub
2. Mount custom UI to DOM
3. Wire extracted handlers to new elements
4. Hide original Windsurf UI elements

### Phase 3: Automation
1. Use CDP to send keyboard events and click events
2. Bridge custom UI events to CDP backend
3. Monitor responses and maintain state

```
┌─────────────────────────────────────────────────────┐
│  Windsurf (via CDP)                                 │
│  ┌───────────────────────────────────────────────┐  │
│  │  Original Cascade UI (hidden)                 │  │
│  │  ├─ Event handlers extracted                  │  │
│  │  ├─ Conversations preserved                   │  │
│  │  └─ Still functional, just invisible          │  │
│  └───────────────────────────────────────────────┘  │
│                      ▲                              │
│                      │ CDP Events                   │
│                      │                              │
│  ┌───────────────────────────────────────────────┐  │
│  │  Custom UI (injected)                         │  │
│  │  ├─ Agent Hub                                 │  │
│  │  ├─ Panel controls                            │  │
│  │  ├─ Wired handlers                            │  │
│  │  └─ Custom styling                            │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
         ▲
         │ Node.js CDP Client
         │
┌────────────────────┐
│  cascade-controller   │
│  (External Node)   │
└────────────────────┘
```

## Key Files

### `src/cascade-controller.js` (Main Controller)
**Purpose**: CDP automation and orchestration layer

**Key Functions**:
- `connect(port)` - Establish CDP connection to Windsurf
- `mountUI()` - Main mounting orchestrator
- `send(index, message)` - Send messages via CDP keyboard events
- `getResponse(index, waitMs)` - Poll for response content
- `spawnCascade()` - Create new Cascade panel via command palette
- `restoreUI()` - Restore original Windsurf UI

**Important Details**:
- Uses `cdpClient.send('Input.dispatchKeyEvent')` for keyboard input
- Character-by-character typing with 15ms delays for Lexical editor
- Robust focus strategy: click panel → click input → focus
- Response polling checks for content stability (stopped typing)

### `src/handler-extractor.js` (Extraction Layer)
**Purpose**: Extract handlers and data from original Windsurf DOM

**Key Functions**:
- `extract()` - Main extraction function
- `getEventListeners(element)` - Extract event listeners from elements
- `wireHandlers(extraction, customElements)` - Wire handlers to new UI
- `cloneHandler(listener)` - Clone handler with proper binding

**Extraction Targets**:
- `.chat-client-root` - Cascade panel containers
- `[contenteditable="true"]` - Input elements
- `button.rounded-full` - Send buttons
- `.cascade-scrollbar` - Conversation areas
- `[aria-label="Cascade (⌘L)"]` - Cascade toggle button

**Important Details**:
- `getEventListeners()` uses Chrome DevTools API (not always available via CDP)
- Fallback: Extract inline event handlers from element properties
- Handlers are cloned with proper `this` binding
- Monaco editor instance accessed via `__zone_symbol__value`

### `src/custom-ui.js` (UI Layer)
**Purpose**: Create and manage custom replacement UI

**Key Components**:
- Toolbar with panel count badge and controls
- Agent Hub with 6 agent slots (Scout, Builder, Reviewer, etc.)
- Panel system with conversation history
- Input areas with contenteditable divs
- Send buttons with event dispatching

**Custom Events**:
- `cascade-send` - Send message to panel (detail: {panelIndex, message})
- `cascade-spawn-panel` - Request new panel creation
- `cascade-agent-toggle` - Toggle agent status (detail: {agent})

**Security Considerations**:
- Uses `textContent` for message display (prevents XSS)
- Module code loaded from local files only (never user input)
- No dynamic code generation from untrusted sources

## Testing Changes

### Basic Connection Test
```bash
node test-controller.js
```
Tests: Connection, workspace trust, panel opening, message sending

### Full Mounting Test
```bash
node test-mount.js
```
Tests: Complete mounting flow, custom UI, handler wiring, message sending through custom UI

**Test Flow**:
1. Connect to Windsurf (port 9333)
2. Dismiss trust dialog
3. Open Cascade panel
4. List existing panels
5. Execute mount
6. Verify extraction stats
7. Send test message
8. Spawn new panel
9. Keep alive for manual testing (Ctrl+C to restore)

### Debugging Tips
```javascript
// Enable verbose logging in cascade-controller.js
const result = await page.evaluate(() => {
  console.log('Starting mount...');
  // ... existing code ...
});

// Check extraction results
const status = cascade.getMountStatus();
console.log(JSON.stringify(status, null, 2));

// Verify DOM state
await page.evaluate(() => {
  console.log('Original panels:', document.querySelectorAll('.chat-client-root').length);
  console.log('Custom UI:', !!document.getElementById('cascade-mount-ui'));
});
```

## Common Patterns

### Sending Messages
Always use the robust focus pattern:
```javascript
await page.evaluate((idx) => {
  const panel = document.querySelectorAll('.chat-client-root')[idx];
  const input = panel.querySelector('[contenteditable="true"]');
  panel.click();                    // Activate panel
  input.scrollIntoView();           // Ensure visibility
  input.click();                    // Focus input
  input.focus();                    // Explicit focus
}, index);

// Type character by character for Lexical
for (const char of message) {
  await cdpClient.send('Input.dispatchKeyEvent', {
    type: 'char',
    text: char
  });
  await sleep(15);  // Critical delay
}
```

### Waiting for Responses
Poll with content stability check:
```javascript
let lastContent = '';
while (Date.now() - startTime < waitMs) {
  const content = await page.evaluate((idx) => {
    return document.querySelectorAll('.chat-client-root')[idx]
      .querySelector('.cascade-scrollbar')?.innerText || '';
  }, index);

  if (content !== lastContent) {
    lastContent = content;
    await sleep(500);  // Still typing
    continue;
  }

  return { response: content, stable: true };  // Stable
}
```

### Module Loading Pattern
The mounting uses `page.evaluate()` to inject and execute module code in the browser context. The module code is read from local files (handler-extractor.js and custom-ui.js) and executed using a module wrapper pattern:

```javascript
// Read trusted local files
const extractorCode = fs.readFileSync('./handler-extractor.js', 'utf8');
const customUICode = fs.readFileSync('./custom-ui.js', 'utf8');

// Execute in browser context
await page.evaluate((extractorSrc, customUISrc) => {
  // Create isolated CommonJS-style module scope
  const runModule = (code) => {
    const module = { exports: {} };
    const moduleFunc = new Function('module', 'exports', code);
    moduleFunc(module, module.exports);
    return module.exports;
  };

  const extractor = runModule(extractorSrc);
  const customUI = runModule(customUISrc);
  // ... use modules
}, extractorCode, customUICode);
```

**Why this approach is safe:**
1. Code comes ONLY from local controlled files
2. No user input or external data is passed to the wrapper
3. This is the only way to load modules in browser context via CDP
4. Alternative approaches (script tags, innerHTML) are blocked by Trusted Types

## Gotchas & Solutions

### 1. Trusted Types Policy Violations
**Problem**: Windsurf enforces Trusted Types, blocking `innerHTML` and dynamic script loading

**Solution**: Load module code via `page.evaluate()` with module wrapper pattern. Code is read from trusted local files only, never from user input or external sources.

### 2. Lexical Editor Input Timing
**Problem**: Lexical editor requires time to process each character

**Solution**: 15ms delay between characters, 200ms after completion
```javascript
for (const char of message) {
  await cdpClient.send('Input.dispatchKeyEvent', { type: 'char', text: char });
  await sleep(15);  // Critical
}
await sleep(200);   // Let Lexical settle
```

### 3. Event Listener Extraction Limitations
**Problem**: `window.getEventListeners()` not available via CDP evaluate

**Solution**: Fallback to inline handler extraction
```javascript
function getEventListeners(element) {
  // Try DevTools API (not available via CDP)
  if (typeof window.getEventListeners === 'function') {
    return window.getEventListeners(element);
  }

  // Fallback: inline handlers
  const listeners = {};
  for (const prop in element) {
    if (prop.startsWith('on') && typeof element[prop] === 'function') {
      listeners[prop.slice(2)] = [{ listener: element[prop] }];
    }
  }
  return listeners;
}
```

### 4. Panel Focus Issues
**Problem**: Input doesn't always receive focus correctly

**Solution**: Triple-focus pattern (panel → input → explicit focus)
```javascript
panel.click();           // 1. Activate panel
input.scrollIntoView();  // 2. Ensure visibility
input.click();           // 3. Focus input
input.focus();           // 4. Explicit focus call
```

### 5. Command Palette Keyboard Shortcuts
**Problem**: ⌘⇧I doesn't work via CDP

**Solution**: Use F1 → type command → Enter
```javascript
// Open command palette
await cdpClient.send('Input.dispatchKeyEvent', {
  type: 'keyDown',
  key: 'F1',
  windowsVirtualKeyCode: 112
});

// Type command
await cdpClient.send('Input.insertText', { text: 'Cascade in new tab' });

// Execute
await cdpClient.send('Input.dispatchKeyEvent', {
  type: 'keyDown',
  key: 'Enter'
});
```

### 6. Response Polling vs. Streaming
**Problem**: No direct access to streaming API

**Solution**: Poll DOM content with stability detection
- Check content every 200ms
- If changed, reset timer (still typing)
- If stable for 500ms, return result
- Max timeout: 10-15 seconds

### 7. Panel Ordering After Spawn
**Problem**: New panels appear at index 0, pushing others down

**Solution**: Track counts and know new panels are always index 0
```javascript
const beforeCount = panels.length;
await spawnCascade();
const afterCount = panels.length;
// New panel is ALWAYS at index 0
return { newIndex: 0, beforeCount, afterCount };
```

## Development Workflow

1. **Start Windsurf** with remote debugging:
   ```bash
   # Windsurf should have --remote-debugging-port=9333
   # This is usually enabled by default
   ```

2. **Make changes** to source files in `src/`

3. **Test changes**:
   ```bash
   node test-mount.js
   ```

4. **Debug in browser**: Open `chrome://inspect` → find Windsurf target → inspect

5. **Restore UI** if stuck: Ctrl+C in test script, or:
   ```javascript
   await cascade.restoreUI();
   ```

## Security & Ethics

**Intended Use**: Automation and enhancement of Windsurf for personal productivity

**Important Notes**:
- This is automation of a tool you own
- All code executes in your local Windsurf instance
- No data leaves your machine
- Handlers are extracted, not modified
- Original functionality is preserved

**Not Intended For**:
- Circumventing license restrictions
- Automated abuse of AI services
- Scraping or harvesting data
- Any malicious purposes

## Future Enhancements

- [ ] Agent orchestration system (multi-agent coordination)
- [ ] Persistent storage of agent configurations
- [ ] Real-time collaboration between agents
- [ ] Custom agent definitions via UI
- [ ] Message routing and task delegation
- [ ] Response streaming (if API access possible)
- [ ] Keyboard shortcut preservation
- [ ] Monaco editor integration for inline editing

## Resources

- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [Puppeteer CDP](https://pptr.dev/)
- [Lexical Editor](https://lexical.dev/) (used by Cascade)
- [Trusted Types](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/trusted-types)
