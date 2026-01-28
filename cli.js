#!/usr/bin/env node

/**
 * Cascade Multiagent - Command Line Interface
 *
 * Usage:
 *   node cli.js connect [port]      - Connect to Windsurf (default port: 9333)
 *   node cli.js mount              - Hijack the UI
 *   node cli.js restore             - Restore original UI
 *   node cli.js send <panel> <msg>  - Send message to panel
 *   node cli.js status              - Show connection status
 *   node cli.js list                - List all panels
 */

const { program } = require('commander');
const cascade = require('./index');

program
  .name('cascade-multiagent')
  .description('CDP-based Windsurf Cascade automation with multi-agent support')
  .version('1.0.0');

program
  .command('connect')
  .description('Connect to Windsurf via CDP')
  .argument('[port]', 'CDP port', '9333')
  .action(async (port) => {
    try {
      console.log(`Connecting to Windsurf on port ${port}...`);
      const result = await cascade.connect(parseInt(port));
      console.log('✓ Connected successfully');
      console.log(`  Page: ${result.pageTitle}`);

      // Keep alive
      console.log('\nConnection established. Press Ctrl+C to disconnect.');
      await new Promise(() => {}); // Never resolves
    } catch (error) {
      console.error('✗ Connection failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('mount')
  .description('Hijack Windsurf UI and replace with custom interface')
  .option('-p, --port <port>', 'CDP port', '9333')
  .action(async (options) => {
    try {
      console.log(`Connecting to Windsurf on port ${options.port}...`);
      await cascade.connect(parseInt(options.port));
      console.log('✓ Connected');

      console.log('Trusting workspace...');
      await cascade.trustWorkspace();

      console.log('Opening Cascade panel...');
      await cascade.open();

      console.log('Hijacking UI...');
      const result = await cascade.mountCustomUI();

      console.log('✓ UI mounted successfully');
      console.log(`  Panels: ${result.extraction.panelCount}`);
      console.log(`  Conversations: ${result.extraction.conversationCount}`);
      console.log(`  Handlers wired: ${result.wired}`);
      console.log(`  Custom UI mounted: ${result.ui.mounted}`);

      console.log('\nHijack complete. Press Ctrl+C to restore and exit.');

      // Handle Ctrl+C
      process.on('SIGINT', async () => {
        console.log('\n\nRestoring UI...');
        await cascade.restoreUI();
        await cascade.disconnect();
        console.log('✓ Restored. Goodbye!');
        process.exit(0);
      });

      await new Promise(() => {}); // Keep alive
    } catch (error) {
      console.error('✗ Hijack failed:', error.message);
      if (error.stack) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program
  .command('restore')
  .description('Restore original Windsurf UI')
  .option('-p, --port <port>', 'CDP port', '9333')
  .action(async (options) => {
    try {
      console.log('Connecting to restore UI...');
      await cascade.connect(parseInt(options.port));

      console.log('Restoring original UI...');
      const result = await cascade.restoreUI();

      if (result.restored) {
        console.log('✓ UI restored successfully');
      } else {
        console.log('✗ Restore failed:', result.error || 'Unknown error');
      }

      await cascade.disconnect();
    } catch (error) {
      console.error('✗ Restore failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('send')
  .description('Send a message to a Cascade panel')
  .argument('<panel>', 'Panel index (0, 1, 2, ...)')
  .argument('<message>', 'Message to send')
  .option('-p, --port <port>', 'CDP port', '9333')
  .option('--no-submit', 'Type message without submitting')
  .action(async (panelIndex, message, options) => {
    try {
      console.log('Connecting...');
      await cascade.connect(parseInt(options.port));

      const index = parseInt(panelIndex);
      console.log(`Sending message to panel ${index}...`);

      const result = await cascade.send(index, message, {
        submit: options.submit !== false
      });

      if (result.sent) {
        console.log('✓ Message sent successfully');

        if (options.submit !== false) {
          console.log('Waiting for response...');
          const response = await cascade.getResponse(index, 15000);

          if (response.stable) {
            console.log('\n--- Response ---');
            console.log(response.response);
          } else {
            console.log('⚠ Response timeout');
          }
        }
      } else {
        console.log('✗ Send failed:', result.error || 'Button not enabled');
      }

      await cascade.disconnect();
    } catch (error) {
      console.error('✗ Send failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show connection and mount status')
  .option('-p, --port <port>', 'CDP port', '9333')
  .action(async (options) => {
    try {
      console.log('Connecting...');
      await cascade.connect(parseInt(options.port));
      console.log('✓ Connected to Windsurf');

      console.log('\nListing panels...');
      const panels = await cascade.listPanels();
      console.log(`Found ${panels.length} panel(s):`);

      panels.forEach(panel => {
        console.log(`  [${panel.index}] ${panel.visible ? '👁' : '🚫'} ${panel.inputContent || '(empty)'}`);
      });

      const mountStatus = cascade.getHijackStatus();
      console.log('\nHijack status:', mountStatus ? 'Active' : 'Not mounted');

      if (mountStatus) {
        console.log(`  Panels: ${mountStatus.extraction.panelCount}`);
        console.log(`  Handlers: ${mountStatus.extraction.handlersExtracted}`);
        console.log(`  UI mounted: ${mountStatus.ui.mounted}`);
      }

      await cascade.disconnect();
    } catch (error) {
      console.error('✗ Status check failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List all Cascade panels')
  .option('-p, --port <port>', 'CDP port', '9333')
  .action(async (options) => {
    try {
      console.log('Connecting...');
      await cascade.connect(parseInt(options.port));

      const panels = await cascade.listPanels();
      console.log(`\nFound ${panels.length} panel(s):\n`);

      if (panels.length === 0) {
        console.log('  No panels found. Open Cascade first.');
      } else {
        panels.forEach(panel => {
          const status = panel.visible ? '✓ visible' : '✗ hidden';
          const enabled = panel.buttonEnabled ? '✓ enabled' : '✗ disabled';
          console.log(`Panel ${panel.index}:`);
          console.log(`  Status: ${status}`);
          console.log(`  Button: ${enabled}`);
          console.log(`  Input: ${panel.inputContent || '(empty)'}`);
          console.log('');
        });
      }

      await cascade.disconnect();
    } catch (error) {
      console.error('✗ List failed:', error.message);
      process.exit(1);
    }
  });

program.parse();
