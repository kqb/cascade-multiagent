const cascade = require('./src/cascade-controller');

async function test() {
  console.log('=== Cascade Stealth Module Test ===\n');
  
  // Connect
  console.log('1. Connecting to Windsurf CDP...');
  const conn = await cascade.connect(9333);
  console.log('   ', conn);
  
  // Trust workspace
  console.log('\n2. Checking trust dialog...');
  const trust = await cascade.trustWorkspace();
  console.log('   ', trust);
  
  // Open Cascade
  console.log('\n3. Opening Cascade panel...');
  const opened = await cascade.open();
  console.log('   ', opened);
  
  // List panels
  console.log('\n4. Listing panels...');
  const panels = await cascade.listPanels();
  console.log('   ', JSON.stringify(panels, null, 2));
  
  // Send message
  console.log('\n5. Sending test message...');
  const sent = await cascade.send(0, 'Reply with just: Module test passed!');
  console.log('   ', sent);
  
  // Get response
  if (sent.sent) {
    console.log('\n6. Waiting for response...');
    const response = await cascade.getResponse(0, 8000);
    console.log('   Response:', response.response?.slice(-200));
  }
  
  // Disconnect
  await cascade.disconnect();
  console.log('\n=== Test Complete ===');
}

test().catch(e => {
  console.error('Error:', e.message);
  cascade.disconnect();
});
