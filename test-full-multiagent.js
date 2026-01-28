const cascade = require('./src/cascade-controller');

async function fullTest() {
  console.log('=== Full Multi-Agent Test ===\n');
  
  await cascade.connect(9333);
  await cascade.trustWorkspace();
  
  // List initial
  console.log('1. Initial state:');
  let panels = await cascade.listPanels();
  console.log(`   ${panels.length} panels`);
  
  // Spawn agent 1
  console.log('\n2. Spawning Agent 1...');
  const spawn1 = await cascade.spawnCascade();
  console.log('   ', spawn1);
  
  // Spawn agent 2
  console.log('\n3. Spawning Agent 2...');
  const spawn2 = await cascade.spawnCascade();
  console.log('   ', spawn2);
  
  // List all panels
  console.log('\n4. All panels:');
  panels = await cascade.listPanels();
  panels.forEach(p => console.log(`   [${p.index}] ${p.id || 'agent'} vis:${p.visible} btn:${p.buttonEnabled}`));
  
  // Send to Agent 1 (should be index 1 now after second spawn)
  console.log('\n5. Sending to panel [1] (Agent 1)...');
  const sent1 = await cascade.send(1, 'You are Agent 1. Reply: Alpha ready!');
  console.log('   ', sent1);
  
  // Send to Agent 2 (index 0 - most recent spawn)
  console.log('\n6. Sending to panel [0] (Agent 2)...');
  const sent2 = await cascade.send(0, 'You are Agent 2. Reply: Beta ready!');
  console.log('   ', sent2);
  
  // Get responses
  if (sent1.sent) {
    console.log('\n7. Agent 1 response:');
    const resp1 = await cascade.getResponse(1, 8000);
    console.log('   ', resp1.response?.slice(-100));
  }
  
  if (sent2.sent) {
    console.log('\n8. Agent 2 response:');
    const resp2 = await cascade.getResponse(0, 8000);
    console.log('   ', resp2.response?.slice(-100));
  }
  
  await cascade.disconnect();
  console.log('\n=== Multi-Agent Test Complete ===');
}

fullTest().catch(e => {
  console.error('Error:', e.message);
  cascade.disconnect();
});
