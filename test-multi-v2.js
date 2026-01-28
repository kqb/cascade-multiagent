const cascade = require('./src/cascade-controller');

async function test() {
  console.log('=== Multi-Agent Test v2 ===\n');
  
  await cascade.connect(9333);
  
  // Get current state
  console.log('1. Current panels:');
  let panels = await cascade.listPanels();
  console.log(`   ${panels.length} total`);
  
  // Try spawning (even if we have panels)
  console.log('\n2. Spawning new Cascade...');
  const spawn = await cascade.spawnCascade();
  console.log('   ', spawn);
  
  // List again
  console.log('\n3. After spawn:');
  panels = await cascade.listPanels();
  panels.forEach(p => console.log(`   [${p.index}] btn:${p.buttonEnabled} content:"${p.inputContent.slice(0,15)}..."`));
  
  // Send to panel 0 (newest spawn)
  console.log('\n4. Sending to [0]...');
  const sent0 = await cascade.send(0, 'Say: Panel zero active');
  console.log('   Result:', sent0);
  
  // Send to panel 1
  console.log('\n5. Sending to [1]...');
  const sent1 = await cascade.send(1, 'Say: Panel one active');
  console.log('   Result:', sent1);
  
  // Get responses
  if (sent0.sent) {
    console.log('\n6. Response from [0]:');
    const r = await cascade.getResponse(0, 6000);
    console.log('   ', r.response?.slice(-80));
  }
  
  if (sent1.sent) {
    console.log('\n7. Response from [1]:');
    const r = await cascade.getResponse(1, 6000);
    console.log('   ', r.response?.slice(-80));
  }
  
  await cascade.disconnect();
  console.log('\n=== Done ===');
}

test().catch(e => { console.error('Error:', e); cascade.disconnect(); });
