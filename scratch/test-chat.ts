async function testChat() {
  console.log('--- Testing AI Chat Stream ---');
  try {
    const response = await fetch('https://backend-datn-y78s.onrender.com/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Chào bạn, bạn là ai?' }]
      })
    });

    if (!response.ok) {
      console.error('Error status:', response.status);
      const text = await response.text();
      console.error('Response:', text);
      return;
    }

    console.log('Connection successful. Receiving stream...');
    
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        process.stdout.write(chunk);
      }
    }
    console.log('\n--- Test Completed ---');
  } catch (err) {
    console.error('Test failed:', err);
  }
}

testChat();
