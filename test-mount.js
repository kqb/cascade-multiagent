/**
 * Test DOM Mounting System
 *
 * Demonstrates the full mounting flow:
 * 1. Connect to Windsurf via CDP
 * 2. Extract handlers from existing Cascade panels
 * 3. Create custom UI with Agent Hub
 * 4. Wire up handlers
 * 5. Destroy original UI
 * 6. Interact through custom interface
 */

const cascade = require('./src/cascade-controller');

async function main() {
  console.log('🎯 Cascade DOM Mounting Test\n');

  // Step 1: Connect to Windsurf
  console.log('1️⃣  Connecting to Windsurf...');
  const connection = await cascade.connect(9333);
  console.log('   ✓ Connected:', connection.pageTitle);

  // Step 2: Dismiss trust dialog if present
  console.log('\n2️⃣  Checking workspace trust...');
  const trust = await cascade.trustWorkspace();
  if (trust.dismissed) {
    console.log('   ✓ Dismissed trust dialog');
  } else {
    console.log('   ✓ No dialog to dismiss');
  }

  // Step 3: Open Cascade panel (if not already open)
  console.log('\n3️⃣  Opening Cascade...');
  const opened = await cascade.open();
  console.log('   ✓ Cascade opened:', opened.opened);

  // Step 4: Check existing panels
  console.log('\n4️⃣  Listing existing panels...');
  const panels = await cascade.listPanels();
  console.log(`   ✓ Found ${panels.length} panel(s):`);
  panels.forEach(panel => {
    console.log(`      • Panel ${panel.index}: ${panel.visible ? 'visible' : 'hidden'}`);
  });

  // Step 5: HIJACK THE DOM
  console.log('\n5️⃣  🔥 HIJACKING WINDSURF DOM...');
  const mountResult = await cascade.mountUI();
  console.log('   ✓ UI Mounted!');
  console.log(`      • Panels extracted: ${mountResult.extraction.panelCount}`);
  console.log(`      • Conversations preserved: ${mountResult.extraction.conversationCount}`);
  console.log(`      • Handlers extracted: ${mountResult.extraction.handlersExtracted}`);
  console.log(`      • Handlers wired: ${mountResult.wired}`);
  console.log(`      • Original elements hidden: ${mountResult.destroyed}`);
  console.log(`      • Custom UI mounted: ${mountResult.ui.mounted}`);

  // Step 6: Get mount status
  console.log('\n6️⃣  Checking mount status...');
  const status = cascade.getMountStatus();
  console.log('   ✓ Status:', JSON.stringify(status, null, 2));

  // Step 7: Test sending message through mounted UI
  console.log('\n7️⃣  Testing message send through custom UI...');
  await cascade.send(0, 'Hello from the mounted interface! 🎉');
  console.log('   ✓ Message sent');

  // Step 8: Wait and get response
  console.log('\n8️⃣  Waiting for response...');
  const response = await cascade.getResponse(0, 15000);
  if (response.stable) {
    console.log('   ✓ Response received');
    console.log('   └─', response.response.substring(0, 100) + '...');
  } else {
    console.log('   ⚠ Response timeout');
  }

  // Step 9: Test spawning new panel
  console.log('\n9️⃣  Testing new panel spawn...');
  const spawned = await cascade.spawnCascade();
  console.log(`   ✓ New panel spawned: ${spawned.spawned}`);
  console.log(`      • Before: ${spawned.beforeCount} panels`);
  console.log(`      • After: ${spawned.afterCount} panels`);
  console.log(`      • New panel at index: ${spawned.newIndex}`);

  // Step 10: Keep running for manual testing
  console.log('\n🎉 Mounting complete! Custom UI is now active.');
  console.log('\n📋 What to do next:');
  console.log('   • Open Windsurf and check the custom UI on the right side');
  console.log('   • Try clicking agents in the Agent Hub');
  console.log('   • Send messages through the custom interface');
  console.log('   • Click "+ New" to spawn additional panels');
  console.log('\n⏸  Press Ctrl+C to restore original UI and disconnect');

  // Wait for interrupt
  process.on('SIGINT', async () => {
    console.log('\n\n🔄 Restoring original UI...');
    await cascade.restoreUI();
    console.log('   ✓ UI restored');
    await cascade.disconnect();
    console.log('   ✓ Disconnected');
    process.exit(0);
  });

  // Keep process alive
  await new Promise(() => {});
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
