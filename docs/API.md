# Cascade Multiagent - API Reference

Complete API documentation for all exported functions and their parameters.

## Table of Contents

- [Connection Management](#connection-management)
  - [connect()](#connect)
  - [disconnect()](#disconnect)
- [Panel Management](#panel-management)
  - [open()](#open)
  - [listPanels()](#listpanels)
  - [getPanelState()](#getpanelstate)
  - [spawnCascade()](#spawncascade)
- [Message Operations](#message-operations)
  - [send()](#send)
  - [getResponse()](#getresponse)
- [UI Mounting](#ui-mounting)
  - [mountUI()](#mountui)
  - [getMountStatus()](#getmountstatus)
  - [restoreUI()](#restoreui)
- [Utilities](#utilities)
  - [trustWorkspace()](#trustworkspace)

---

## Connection Management

### connect()

Establish a CDP (Chrome DevTools Protocol) connection to Windsurf.

#### Signature
```javascript
connect(port = 9333): Promise<ConnectionResult>
```

#### Parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `port` | number | `9333` | CDP port number where Windsurf is listening |

#### Returns

**Type**: `Promise<ConnectionResult>`

```typescript
interface ConnectionResult {
  connected: boolean;  // Always true if no error
  pageTitle: string;   // Window title (includes project path)
}
```

#### Example

```javascript
const cascade = require('./src/cascade-controller');

// Connect with default port
const result = await cascade.connect();
console.log('Connected:', result.connected);
console.log('Window title:', result.pageTitle);

// Connect with custom port
const result2 = await cascade.connect(9222);
```

#### Errors

Throws an error if:
- Windsurf is not running
- CDP port is not accessible
- Connection times out

#### Notes

- Connection must be established before any other operations
- Only one connection can be active at a time
- The first page returned by `browser.pages()` is used (main workbench)

---

### disconnect()

Close the CDP connection to Windsurf.

#### Signature
```javascript
disconnect(): Promise<void>
```

#### Parameters

None

#### Returns

**Type**: `Promise<void>`

#### Example

```javascript
await cascade.disconnect();
console.log('Disconnected from Windsurf');
```

#### Notes

- Safe to call even if not connected
- Clears internal browser, page, and CDP client references
- Should be called when done to free resources

---

## Panel Management

### open()

Open the Cascade panel by clicking the Cascade button in the sidebar.

#### Signature
```javascript
open(): Promise<OpenResult>
```

#### Parameters

None

#### Returns

**Type**: `Promise<OpenResult>`

```typescript
interface OpenResult {
  opened: boolean;           // True if button was found and clicked
  error?: string;            // Error message if button not found
}
```

#### Example

```javascript
const result = await cascade.open();
if (result.opened) {
  console.log('Cascade panel opened');
} else {
  console.error('Failed to open:', result.error);
}
```

#### Notes

- Looks for button with `aria-label="Cascade (⌘L)"`
- Waits 1 second after clicking for panel to open
- Safe to call even if panel is already open

---

### listPanels()

Get information about all Cascade panels currently in the DOM.

#### Signature
```javascript
listPanels(): Promise<PanelInfo[]>
```

#### Parameters

None

#### Returns

**Type**: `Promise<PanelInfo[]>`

```typescript
interface PanelInfo {
  index: number;           // Panel index (0-based)
  id: string | null;       // DOM id attribute if present
  visible: boolean;        // Whether panel is currently visible
  inputContent: string;    // Current input field content (truncated to 50 chars)
  buttonEnabled: boolean;  // Whether send button is enabled
}
```

#### Example

```javascript
const panels = await cascade.listPanels();
console.log(`Found ${panels.length} panel(s)`);

panels.forEach(panel => {
  console.log(`Panel ${panel.index}:`);
  console.log(`  Visible: ${panel.visible}`);
  console.log(`  Input: "${panel.inputContent}"`);
  console.log(`  Can send: ${panel.buttonEnabled}`);
});
```

#### Notes

- Panels are selected via `.chat-client-root` class
- New panels appear at index 0, pushing others down
- Visible means panel has non-zero width and height

---

### getPanelState()

Get detailed state information for a specific panel.

#### Signature
```javascript
getPanelState(index = 0): Promise<PanelState>
```

#### Parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `index` | number | `0` | Panel index to query |

#### Returns

**Type**: `Promise<PanelState>`

```typescript
interface PanelState {
  index: number;           // Requested panel index
  visible: boolean;        // Whether panel is visible
  inputContent: string;    // Full input field content
  buttonEnabled: boolean;  // Whether send button is enabled
  totalPanels: number;     // Total number of panels
  error?: string;          // Error if panel not found
}
```

#### Example

```javascript
const state = await cascade.getPanelState(0);

if (state.error) {
  console.error('Panel not found:', state.error);
} else {
  console.log('Panel state:', state);
  console.log('Ready to send:', state.buttonEnabled);
}
```

#### Notes

- Returns error if panel index doesn't exist
- Button enabled when input has content and is valid
- Button has class `cursor-not-allowed` when disabled

---

### spawnCascade()

Create a new Cascade panel via the command palette.

#### Signature
```javascript
spawnCascade(): Promise<SpawnResult>
```

#### Parameters

None

#### Returns

**Type**: `Promise<SpawnResult>`

```typescript
interface SpawnResult {
  spawned: boolean;     // True if new panel was created
  beforeCount: number;  // Panel count before spawning
  afterCount: number;   // Panel count after spawning
  newIndex: number;     // Index of new panel (always 0)
}
```

#### Example

```javascript
const result = await cascade.spawnCascade();

if (result.spawned) {
  console.log(`Created new panel at index ${result.newIndex}`);
  console.log(`Total panels: ${result.afterCount}`);
} else {
  console.log('No new panel created');
}
```

#### Process

1. Close any open dialogs with Escape
2. Open command palette with F1
3. Type "Cascade in new tab"
4. Press Enter to execute
5. Wait 2 seconds for panel creation
6. Compare panel counts

#### Notes

- New panels ALWAYS appear at index 0
- Previous panel 0 becomes panel 1, etc.
- Uses F1 instead of ⌘P because ⌘⇧I doesn't work via CDP
- Waits 2 seconds for panel initialization

---

## Message Operations

### send()

Send a message to a specific Cascade panel.

#### Signature
```javascript
send(index, message, options = {}): Promise<SendResult>
```

#### Parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `index` | number | - | Panel index (required) |
| `message` | string | - | Message to send (required) |
| `options` | object | `{}` | Optional configuration |
| `options.clear` | boolean | `true` | Clear input before typing |
| `options.submit` | boolean | `true` | Click send button after typing |

#### Returns

**Type**: `Promise<SendResult>`

```typescript
interface SendResult {
  sent: boolean;              // True if message was submitted
  message?: string;           // The message that was sent
  error?: string;             // Error message if failed
  buttonEnabled?: boolean;    // Button state if not submitted
  inputContent?: string;      // Input content if not submitted
}
```

#### Example

```javascript
// Basic send
await cascade.send(0, 'Hello, Cascade!');

// Type without submitting
const result = await cascade.send(0, 'Draft message', {
  clear: true,
  submit: false
});
console.log('Typed but not sent:', result.inputContent);

// Append to existing input
await cascade.send(0, ' Additional text', {
  clear: false,
  submit: true
});
```

#### Process

1. Focus the panel and input field (robust multi-step focus)
2. If `clear=true`, select all (Cmd+A) and delete
3. Type message character-by-character with 15ms delays
4. Wait 200ms for Lexical editor to settle
5. If `submit=true` and button enabled, click send button

#### Notes

- Uses CDP keyboard events for typing
- Character-by-character typing required for Lexical editor
- Focus strategy: panel click → input scroll → input click → explicit focus
- Send button disabled until input passes validation

#### Errors

Returns `{sent: false, error: '...'}` if:
- Panel not found
- Input element not found
- Focus failed

---

### getResponse()

Retrieve the latest response from a Cascade panel.

#### Signature
```javascript
getResponse(index, waitMs = 10000): Promise<ResponseResult>
```

#### Parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `index` | number | - | Panel index (required) |
| `waitMs` | number | `10000` | Maximum wait time in milliseconds |

#### Returns

**Type**: `Promise<ResponseResult>`

```typescript
interface ResponseResult {
  response: string;      // Full conversation text
  stable?: boolean;      // True if response finished (stable)
  timeout?: boolean;     // True if max time reached
}
```

#### Example

```javascript
// Send and wait for response
await cascade.send(0, 'Explain async/await');
const result = await cascade.getResponse(0, 15000);

if (result.stable) {
  console.log('Complete response:', result.response);
} else if (result.timeout) {
  console.log('Timed out. Partial response:', result.response);
}

// Poll with longer timeout for complex queries
const longResult = await cascade.getResponse(0, 30000);
```

#### Algorithm

1. Read conversation text from `.cascade-scrollbar` element
2. Compare with previous read
3. If changed, reset stability timer (still typing)
4. If unchanged for 500ms, consider stable
5. Return when stable or timeout reached

#### Notes

- Returns full conversation content, not just latest message
- Polls every 200ms
- Considers content stable after 500ms of no changes
- Use `response.split('\n')` to parse messages
- Increase `waitMs` for complex queries

#### Best Practices

```javascript
// Extract just the assistant's response
const result = await cascade.getResponse(0);
const lines = result.response.split('\n');
const lastResponse = lines[lines.length - 1];

// Check for stability
if (!result.stable) {
  console.warn('Response may be incomplete');
}
```

---

## UI Mounting

### mountUI()

Replace Windsurf's native UI with custom Agent Hub interface.

#### Signature
```javascript
mountUI(): Promise<MountResult>
```

#### Parameters

None

#### Returns

**Type**: `Promise<MountResult>`

```typescript
interface MountResult {
  success: boolean;
  extraction: {
    panelCount: number;           // Number of panels extracted
    conversationCount: number;    // Number of conversations preserved
    handlersExtracted: number;    // Number of handler groups extracted
  };
  wired: number;                  // Number of handlers successfully wired
  destroyed: number;              // Number of original elements hidden
  ui: {
    mounted: boolean;             // Whether custom UI is in DOM
  };
  error?: string;                 // Error message if failed
  stack?: string;                 // Stack trace if failed
}
```

#### Example

```javascript
const result = await cascade.mountUI();

if (result.success) {
  console.log('UI mounted successfully!');
  console.log(`Preserved ${result.extraction.conversationCount} conversations`);
  console.log(`Wired ${result.wired} event handlers`);
} else {
  console.error('Mount failed:', result.error);
}
```

#### Process

1. Load handler-extractor.js and custom-ui.js from disk
2. Execute modules in browser context via `page.evaluate()`
3. Extract handlers, conversations, and DOM references
4. Create custom UI structure
5. Mount custom UI to DOM
6. Wire extracted handlers to new elements
7. Hide original Windsurf UI elements
8. Set up event bridges between custom UI and CDP backend

#### Custom Events Dispatched

The custom UI dispatches these events:

```javascript
// Send message from panel
window.dispatchEvent(new CustomEvent('cascade-send', {
  detail: { panelIndex: 0, message: 'Hello' }
}));

// Spawn new panel
window.dispatchEvent(new CustomEvent('cascade-spawn-panel'));

// Toggle agent
window.dispatchEvent(new CustomEvent('cascade-agent-toggle', {
  detail: { agent: 'Scout' }
}));
```

#### Event Bridges

Automatically set up via `setupEventBridges()`:

```javascript
// Bridges custom UI events to CDP functions
window.addEventListener('cascade-send', async (e) => {
  await window.cascadeSendMessage(e.detail.panelIndex, e.detail.message);
});

window.addEventListener('cascade-spawn-panel', async () => {
  await window.cascadeSpawnPanel();
});
```

#### Notes

- Must be connected before calling
- Cascade panel should be open for best results
- Original UI is hidden, not removed
- All conversations and state are preserved
- Event handlers are cloned and rewired

#### Errors

Throws if:
- Not connected to CDP
- Source files missing
- Module execution fails
- Trusted Types violations (shouldn't happen with current approach)

---

### getMountStatus()

Get the current mounting status.

#### Signature
```javascript
getMountStatus(): MountResult | null
```

#### Parameters

None

#### Returns

**Type**: `MountResult | null`

Returns the result from last `mountUI()` call, or `null` if UI not mounted.

#### Example

```javascript
const status = cascade.getMountStatus();

if (status) {
  console.log('UI is mounted');
  console.log('Panels:', status.extraction.panelCount);
} else {
  console.log('UI not mounted');
}
```

#### Notes

- Simple getter for internal state
- Doesn't verify actual DOM state
- Returns null after `restoreUI()` or `disconnect()`

---

### restoreUI()

Restore the original Windsurf UI (undo mounting).

#### Signature
```javascript
restoreUI(): Promise<RestoreResult>
```

#### Parameters

None

#### Returns

**Type**: `Promise<RestoreResult>`

```typescript
interface RestoreResult {
  restored: boolean;
  error?: string;
}
```

#### Example

```javascript
// Restore after mounting
const result = await cascade.restoreUI();

if (result.restored) {
  console.log('Original UI restored');
} else {
  console.log('Error:', result.error);
}
```

#### Process

1. Remove custom UI root element (`#cascade-mount-ui`)
2. Show all `.chat-client-root` elements (remove `display: none`)
3. Show sidebar if it was hidden
4. Clear internal mount status

#### Notes

- Safe to call even if not mounted
- Returns error if not connected or not mounted
- Original conversations remain intact
- Doesn't disconnect from CDP

---

## Utilities

### trustWorkspace()

Automatically dismiss the workspace trust dialog if present.

#### Signature
```javascript
trustWorkspace(): Promise<TrustResult>
```

#### Parameters

None

#### Returns

**Type**: `Promise<TrustResult>`

```typescript
interface TrustResult {
  dismissed: boolean;      // True if dialog was found and dismissed
  text?: string;           // Button text that was clicked
  noDialog?: boolean;      // True if no dialog was present
}
```

#### Example

```javascript
const result = await cascade.trustWorkspace();

if (result.dismissed) {
  console.log('Dismissed trust dialog:', result.text);
} else if (result.noDialog) {
  console.log('No dialog present');
}
```

#### Process

1. Query for buttons in dialog containers
2. Look for button with text containing "Yes, I trust"
3. Click button if found
4. Wait 500ms for dialog to close

#### Notes

- Searches for common button selectors
- Safe to call even if dialog not present
- Only clicks buttons with "Yes, I trust" in text
- Use after `connect()` and before other operations

---

## Type Definitions

### Summary of All Types

```typescript
// Connection
interface ConnectionResult {
  connected: boolean;
  pageTitle: string;
}

// Panels
interface PanelInfo {
  index: number;
  id: string | null;
  visible: boolean;
  inputContent: string;
  buttonEnabled: boolean;
}

interface PanelState extends PanelInfo {
  totalPanels: number;
  error?: string;
}

interface SpawnResult {
  spawned: boolean;
  beforeCount: number;
  afterCount: number;
  newIndex: number;
}

// Messages
interface SendResult {
  sent: boolean;
  message?: string;
  error?: string;
  buttonEnabled?: boolean;
  inputContent?: string;
}

interface SendOptions {
  clear?: boolean;
  submit?: boolean;
}

interface ResponseResult {
  response: string;
  stable?: boolean;
  timeout?: boolean;
}

// Mounting
interface MountResult {
  success: boolean;
  extraction: {
    panelCount: number;
    conversationCount: number;
    handlersExtracted: number;
  };
  wired: number;
  destroyed: number;
  ui: {
    mounted: boolean;
  };
  error?: string;
  stack?: string;
}

interface RestoreResult {
  restored: boolean;
  error?: string;
}

// Utilities
interface OpenResult {
  opened: boolean;
  error?: string;
}

interface TrustResult {
  dismissed: boolean;
  text?: string;
  noDialog?: boolean;
}
```

---

## Usage Patterns

### Complete Workflow

```javascript
const cascade = require('./src/cascade-controller');

async function completeWorkflow() {
  try {
    // 1. Connect
    await cascade.connect(9333);

    // 2. Dismiss trust dialog
    await cascade.trustWorkspace();

    // 3. Open Cascade
    await cascade.open();

    // 4. Mount UI (optional)
    await cascade.mountUI();

    // 5. List panels
    const panels = await cascade.listPanels();

    // 6. Send messages
    for (let i = 0; i < panels.length; i++) {
      await cascade.send(i, `Task for panel ${i}`);
      const response = await cascade.getResponse(i);
      console.log(`Panel ${i}:`, response.response);
    }

    // 7. Spawn new panel
    await cascade.spawnCascade();

    // 8. Restore UI
    await cascade.restoreUI();

    // 9. Disconnect
    await cascade.disconnect();
  } catch (error) {
    console.error('Error:', error);
    await cascade.disconnect();
  }
}

completeWorkflow();
```

### Error Handling

```javascript
async function robustSend(index, message) {
  try {
    // Check panel exists
    const state = await cascade.getPanelState(index);
    if (state.error) {
      throw new Error(`Panel ${index} not found`);
    }

    // Send with retry
    let attempts = 0;
    let result;
    while (attempts < 3) {
      result = await cascade.send(index, message);
      if (result.sent) break;
      attempts++;
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!result.sent) {
      throw new Error('Failed to send after 3 attempts');
    }

    // Get response with extended timeout
    const response = await cascade.getResponse(index, 20000);
    if (!response.stable) {
      console.warn('Response may be incomplete');
    }

    return response;
  } catch (error) {
    console.error('Send error:', error.message);
    throw error;
  }
}
```

---

## Best Practices

1. **Always check connection**: Verify `connect()` succeeds before other operations
2. **Handle trust dialogs early**: Call `trustWorkspace()` immediately after connecting
3. **Poll with appropriate timeouts**: Use longer timeouts for complex queries
4. **Check panel state before sending**: Verify panel exists and button is enabled
5. **Use robust error handling**: Wrap operations in try-catch blocks
6. **Clean up on exit**: Always call `disconnect()` when done
7. **Restore UI before disconnect**: Call `restoreUI()` if you mounted the UI
8. **Monitor response stability**: Check `stable` flag on responses
9. **Respect timing constraints**: Don't remove delays in send operations
10. **Test mounting separately**: Use `test-mount.js` to test UI mounting in isolation
