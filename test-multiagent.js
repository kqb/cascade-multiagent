const cascade = require('./src/cascade-controller');

async function testMultiAgent() {
  console.log('=== Multi-Agent Spawn Test ===\n');
  
  await cascade.connect(9333);
  await cascade.trustWorkspace();
  await cascade.open();
  
  // List initial panels
  console.log('1. Initial panels:');
  let panels = await cascade.listPanels();
  console.log('   Count:', panels.length);
  panels.forEach(p => console.log(`   [${p.index}] ${p.id || 'spawned'} visible:${p.visible} btn:${p.buttonEnabled}`));
  
  // Spawn new Cascade via ⌘⇧I
  console.log('\n2. Spawning new Cascade (⌘⇧I)...');
  const spawn1 = await cascade.spawnCascade();
  console.log('   Result:', spawn1);
  
  // List panels again
  console.log('\n3. Panels after spawn:');
  panels = await cascade.listPanels();
  console.log('   Count:', panels.length);
  panels.forEach(p => console.log(`   [${p.index}] ${p.id || 'spawned'} visible:${p.visible} btn:${p.buttonEnabled}`));
  
  // Spawn another
  console.log('\n4. Spawning second Cascade...');
  const spawn2 = await cascade.spawnCascade();
  console.log('   Result:', spawn2);
  
  // List all
  console.log('\n5. Final panel list:');
  panels = await cascade.listPanels();
  console.log('   Count:', panels.length);
  panels.forEach(p => console.log(`   [${p.index}] ${p.id || 'spawned'} visible:${p.visible} btn:${p.buttonEnabled}`));
  
  // Test sending to spawned panel (index 1 if it exists)
  if (panels.length > 1) {
    console.log('\n6. Sending to spawned panel [1]...');
    const sent = await cascade.send(1, 'Reply: Agent 1 active!');
    console.log('   Sent:', sent);
    
    if (sent.sent) {
      console.log('   Waiting for response...');
      const resp = await cascade.getResponse(1, 8000);
      console.log('   Response:', resp.response?.slice(-150));
    }
  }
  
  await cascade.disconnect();
  console.log('\n=== Test Complete ===');
}

testMultiAgent().catch(e => {
  console.error('Error:', e.message);
  cascade.disconnect();
});
