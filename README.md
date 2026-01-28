# Cascade Multiagent

CDP-based DOM mounting for Windsurf's Cascade AI assistant interface with multi-agent support.

## Installation

```bash
npm install
```

## Usage

### Interactive Mode (Recommended)

Start the interactive REPL that auto-connects and mounts the UI:

```bash
npm start
# or
node start.js
```

Available commands in REPL:
- `send <panel> <message>` - Send message to a panel
- `list` - List all panels
- `spawn` - Create new Cascade panel
- `status` - Show current status
- `restore` - Restore original Windsurf UI
- `help` - Show help
- `exit` - Exit and cleanup

### CLI Commands

```bash
# Connect to Windsurf
node cli.js connect [port]

# Mount the UI
node cli.js mount
# or
npm run mount

# Restore original UI
node cli.js restore
# or
npm run restore

# Send a message
node cli.js send 0 "Hello Cascade!"

# Check status
node cli.js status
# or
npm run status

# List panels
node cli.js list
```

### Programmatic API

```javascript
const cascade = require('cascade-multiagent');

async function main() {
  // Connect to Windsurf
  await cascade.connect(9333);

  // Setup
  await cascade.trustWorkspace();
  await cascade.open();

  // Mount the UI
  const result = await cascade.mountUI();
  console.log('Mounted:', result);

  // Send a message
  await cascade.send(0, 'Hello from code!');

  // Get response
  const response = await cascade.getResponse(0, 15000);
  console.log('Response:', response.response);

  // Spawn new panel
  await cascade.spawnCascade();

  // List panels
  const panels = await cascade.listPanels();
  console.log('Panels:', panels);

  // Restore and cleanup
  await cascade.restoreUI();
  await cascade.disconnect();
}

main();
```

## Requirements

- Windsurf with remote debugging enabled (port 9333)
- Node.js >= 16.0.0
- puppeteer-core

## Architecture

The system operates in three phases:

1. **Connection & Extraction** - Connect via CDP and extract handlers
2. **UI Replacement** - Mount custom UI with Agent Hub
3. **Automation** - Bridge CDP events to custom interface

## Security

This tool automates a local Windsurf instance via CDP. All code executes locally. No data leaves your machine. See CLAUDE.md for details.

## License

MIT
