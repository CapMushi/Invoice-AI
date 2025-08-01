import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3000/api/ai/invoice-tool';

// Test multi-step workflow detection and processing
async function testMultiStepWorkflow() {
  console.log('Testing multi-step workflow...');
  
  // Test 1: Simple single-step operation
  console.log('Test 1: Single-step operation');
  const singleStepResponse = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'show me all invoices'
    }),
  });
  const singleStepData = await singleStepResponse.json();
  console.log('Single-step result:', {
    isMultiStep: singleStepData.result?.isMultiStep,
    totalSteps: singleStepData.result?.totalSteps,
    workflowSteps: singleStepData.result?.workflowSteps
  });
  
  // Test 2: Multi-step workflow - Create and email
  console.log('\nTest 2: Multi-step workflow - Create and email');
  const multiStepResponse = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'create an invoice for $500 for Amy\'s Bird Sanctuary and email it to test@example.com'
    }),
  });
  const multiStepData = await multiStepResponse.json();
  console.log('Multi-step result:', {
    isMultiStep: multiStepData.result?.isMultiStep,
    totalSteps: multiStepData.result?.totalSteps,
    completedSteps: multiStepData.result?.completedSteps,
    failedSteps: multiStepData.result?.failedSteps,
    workflowSteps: multiStepData.result?.workflowSteps
  });
  
  // Test 3: Multi-step workflow - Find and update
  console.log('\nTest 3: Multi-step workflow - Find and update');
  const findUpdateResponse = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'find invoice 123 and update the amount to $600'
    }),
  });
  const findUpdateData = await findUpdateResponse.json();
  console.log('Find and update result:', {
    isMultiStep: findUpdateData.result?.isMultiStep,
    totalSteps: findUpdateData.result?.totalSteps,
    completedSteps: findUpdateData.result?.completedSteps,
    failedSteps: findUpdateData.result?.failedSteps,
    workflowSteps: findUpdateData.result?.workflowSteps
  });
  
  // Test 4: Complex multi-step workflow
  console.log('\nTest 4: Complex multi-step workflow');
  const complexResponse = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'list all unpaid invoices then create a new invoice for $1000 for Test Customer and email it to admin@test.com'
    }),
  });
  const complexData = await complexResponse.json();
  console.log('Complex workflow result:', {
    isMultiStep: complexData.result?.isMultiStep,
    totalSteps: complexData.result?.totalSteps,
    completedSteps: complexData.result?.completedSteps,
    failedSteps: complexData.result?.failedSteps,
    workflowSteps: complexData.result?.workflowSteps
  });
}

// Test general conversation vs. invoice-related detection
async function testMessageDetection() {
  console.log('\n=== Testing Message Detection ===');
  
  // Test general conversation
  console.log('Test: General conversation');
  const generalResponse = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'hello, how are you?'
    }),
  });
  const generalData = await generalResponse.json();
  console.log('General conversation result:', {
    isMultiStep: generalData.result?.isMultiStep,
    totalSteps: generalData.result?.totalSteps,
    toolCalls: generalData.result?.toolCalls?.length || 0
  });
  
  // Test invoice-related single operation
  console.log('\nTest: Invoice-related single operation');
  const invoiceResponse = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'get invoice 123'
    }),
  });
  const invoiceData = await invoiceResponse.json();
  console.log('Invoice operation result:', {
    isMultiStep: invoiceData.result?.isMultiStep,
    totalSteps: invoiceData.result?.totalSteps,
    toolCalls: invoiceData.result?.toolCalls?.length || 0
  });
}

async function runAllTests() {
  try {
    await testMultiStepWorkflow();
    await testMessageDetection();
    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

export { testMultiStepWorkflow, testMessageDetection }; 