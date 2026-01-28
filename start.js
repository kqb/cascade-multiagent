#!/usr/bin/env node

/**
 * Cascade Multiagent - Interactive REPL
 *
 * Automatically connects to Windsurf and mounts the UI,
 * then provides an interactive prompt for commands.
 */

const readline = require('readline');
const cascade = require('./index');

const PORT = 9333;
let connected = false;
let mounted = false;

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

async function initialize() {
  try {
    log('\n╔═══════════════════════════════════════════╗', 'cyan');
    log('║   Cascade Multiagent - Interactive Mode  ║', 'cyan');
    log('╚═══════════════════════════════════════════╝', 'cyan');
    log('');

    log('→ Connecting to Windsurf...', 'gray');
    const result = await cascade.connect(PORT);
    connected = true;
    log(`✓ Connected to: ${result.pageTitle}`, 'green');

    log('→ Trusting workspace...', 'gray');
    await cascade.trustWorkspace();

    log('→ Opening Cascade panel...', 'gray');
    await cascade.open();

    log('→ Hijacking UI...', 'gray');
    const mountResult = await cascade.mountCustomUI();
    mounted = true;

    log('✓ UI mounted successfully!', 'green');
    log(`  Panels: ${mountResult.extraction.panelCount}`, 'gray');
    log(`  Handlers: ${mountResult.extraction.handlersExtracted}`, 'gray');
    log('');

    // startREPL();
  } catch (error) {
    log(`✗ Initialization failed: ${error.message}`, 'red');
    console.error(error.stack);
    process.exit(1);
  }
}

function startREPL() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: colors.cyan + 'cascade> ' + colors.reset
  });

  log('Ready! Type "help" for available commands.', 'yellow');
  log('');
  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    const [command, ...args] = input.split(' ');

    try {
      switch (command.toLowerCase()) {
        case 'help':
          showHelp();
          break;

        case 'send':
          if (args.length < 2) {
            log('Usage: send <panel> <message>', 'red');
          } else {
            const panelIndex = parseInt(args[0]);
            const message = args.slice(1).join(' ');
            await sendMessage(panelIndex, message);
          }
          break;

        case 'list':
          await listPanels();
          break;

        case 'spawn':
          await spawnPanel();
          break;

        case 'status':
          showStatus();
          break;

        case 'restore':
          await restoreUI();
          break;

        case 'exit':
        case 'quit':
          await cleanup();
          process.exit(0);
          break;

        default:
          log(`Unknown command: ${command}. Type "help" for available commands.`, 'red');
      }
    } catch (error) {
      log(`Error: ${error.message}`, 'red');
    }

    rl.prompt();
  });

  rl.on('SIGINT', async () => {
    log('\n\nReceived Ctrl+C...', 'yellow');
    await cleanup();
    process.exit(0);
  });

  rl.on('close', async () => {
    await cleanup();
    process.exit(0);
  });
}

function showHelp() {
  log('\nAvailable commands:', 'bright');
  log('  send <panel> <message>  Send message to panel (e.g., send 0 Hello!)', 'gray');
  log('  list                    List all panels', 'gray');
  log('  spawn                   Create new Cascade panel', 'gray');
  log('  status                  Show current status', 'gray');
  log('  restore                 Restore original Windsurf UI', 'gray');
  log('  help                    Show this help message', 'gray');
  log('  exit                    Exit and cleanup', 'gray');
  log('');
}

async function sendMessage(panelIndex, message) {
  log(`→ Sending to panel ${panelIndex}...`, 'gray');

  const result = await cascade.send(panelIndex, message);

  if (result.sent) {
    log('✓ Message sent', 'green');

    log('→ Waiting for response...', 'gray');
    const response = await cascade.getResponse(panelIndex, 15000);

    if (response.stable) {
      log('\n--- Response ---', 'cyan');
      console.log(response.response);
      log('--- End ---\n', 'cyan');
    } else {
      log('⚠ Response timeout', 'yellow');
    }
  } else {
    log(`✗ Send failed: ${result.error || 'Button not enabled'}`, 'red');
  }
}

async function listPanels() {
  const panels = await cascade.listPanels();

  log(`\nFound ${panels.length} panel(s):`, 'bright');

  if (panels.length === 0) {
    log('  No panels found.', 'gray');
  } else {
    panels.forEach(panel => {
      const status = panel.visible ? '✓' : '✗';
      const enabled = panel.buttonEnabled ? 'ready' : 'busy';
      log(`  [${panel.index}] ${status} ${enabled} - ${panel.inputContent || '(empty)'}`, 'gray');
    });
  }
  log('');
}

async function spawnPanel() {
  log('→ Spawning new panel...', 'gray');

  const result = await cascade.spawnCascade();

  if (result.spawned) {
    log(`✓ Panel spawned at index ${result.newIndex}`, 'green');
    log(`  Total panels: ${result.afterCount}`, 'gray');
  } else {
    log('✗ Failed to spawn panel', 'red');
  }
}

function showStatus() {
  log('\nStatus:', 'bright');
  log(`  Connected: ${connected ? '✓' : '✗'}`, connected ? 'green' : 'red');
  log(`  UI Hijacked: ${mounted ? '✓' : '✗'}`, mounted ? 'green' : 'red');
  log(`  Port: ${PORT}`, 'gray');

  const mountStatus = cascade.getHijackStatus();
  if (mountStatus) {
    log(`  Panels: ${mountStatus.extraction.panelCount}`, 'gray');
    log(`  Handlers: ${mountStatus.extraction.handlersExtracted}`, 'gray');
  }
  log('');
}

async function restoreUI() {
  if (!mounted) {
    log('UI not mounted, nothing to restore.', 'yellow');
    return;
  }

  log('→ Restoring original UI...', 'gray');
  const result = await cascade.restoreUI();

  if (result.restored) {
    log('✓ UI restored', 'green');
    mounted = false;
  } else {
    log(`✗ Restore failed: ${result.error}`, 'red');
  }
}

async function cleanup() {
  log('\n→ Cleaning up...', 'gray');

  if (mounted) {
    await cascade.restoreUI();
    log('✓ UI restored', 'green');
  }

  if (connected) {
    await cascade.disconnect();
    log('✓ Disconnected', 'green');
  }

  log('Goodbye!', 'cyan');
}

// Start the interactive session
initialize().catch(error => {
  log(`Fatal error: ${error.message}`, 'red');
  console.error(error.stack);
  process.exit(1);
});
