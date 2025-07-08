import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api/ai/invoice-tool';

async function testGetInvoice() {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool: 'getInvoice',
      params: { invoiceId: '123' },
    }),
  });
  const data = await response.json();
  console.log('getInvoice result:', data);
}

async function runTests() {
  await testGetInvoice();
  // Add more tests for other tools here
}

runTests().catch(console.error); 