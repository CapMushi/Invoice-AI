# Multi-Step Workflow Implementation

## Overview

This document describes the implementation of multi-step workflows in the Invoice Management Tool. The system can now handle complex operations that require multiple tool calls in sequence, with proper coordination between steps and real-time UI updates.

## Architecture

### 1. AI Route Enhancements (`apps/web/app/api/ai/invoice-tool/route.ts`)

**Multi-Step Detection:**
- Automatically detects multi-step operations using keywords like "and", "then", "after"
- Identifies common patterns like "create and email", "find and update", "update and send"

**Workflow Tracking:**
- Tracks each step's completion status (Completed/Failed)
- Provides step-by-step progress updates
- Maintains workflow state throughout the operation

**Enhanced Prompting:**
- Different prompting strategies for single-step vs. multi-step operations
- Provides clear instructions for step coordination
- Includes error handling and recovery guidance

### 2. UI Enhancements (`apps/web/app/page.tsx`)

**Step-by-Step Processing:**
- Processes each tool call individually
- Applies UI updates after each step completion
- Accumulates results for final display

**Multi-Step Response Display:**
- Shows numbered step results for multi-step operations
- Displays workflow progress information
- Provides clear feedback on operation completion

**State Management:**
- Maintains proper state flow between steps
- Handles UI updates for each operation type
- Manages invoice list and selection state

## Supported Multi-Step Workflows

### 1. Create and Email
**Example:** "Create an invoice for $500 for Acme Corp and email it to john@acme.com"

**Steps:**
1. Create invoice using `createInvoice` tool
2. Email the created invoice using `emailInvoicePdf` tool (uses ID from step 1)

### 2. Find and Update
**Example:** "Find invoice 123 and update the amount to $600"

**Steps:**
1. Retrieve invoice using `getInvoice` tool
2. Update the invoice using `updateInvoice` tool

### 3. List and Create
**Example:** "List all unpaid invoices then create a new invoice for $1000 for Test Customer"

**Steps:**
1. List invoices using `listInvoices` tool with "unpaid" filter
2. Create new invoice using `createInvoice` tool

### 4. Complex Workflows
**Example:** "List all unpaid invoices then create a new invoice for $1000 for Test Customer and email it to admin@test.com"

**Steps:**
1. List unpaid invoices
2. Create new invoice
3. Email the created invoice

## Features

### Automatic Tool Coordination
- Results from one step are automatically passed to the next step
- Invoice IDs from creation are used for subsequent operations
- Error handling prevents proceeding if a step fails

### No Hardcoding
- Dynamic multi-step detection based on message content
- Flexible workflow patterns that adapt to user requests
- Supports any combination of CRUD operations

### Step-by-Step UI Updates
- Invoice panel updates after each step
- Chat shows progress through each step
- Real-time feedback on operation status

### Error Handling
- Graceful handling of step failures
- Clear error messages for each step
- Workflow stops on first failure

## Response Format

### Single-Step Operation
```json
{
  "result": {
    "text": "Invoice #123 created successfully",
    "isMultiStep": false,
    "totalSteps": 1,
    "completedSteps": 1,
    "failedSteps": 0,
    "workflowSteps": ["Step 1: createInvoice - Completed"]
  }
}
```

### Multi-Step Operation
```json
{
  "result": {
    "text": "Multi-step operation completed:\n\n1. Invoice #123 created successfully\n\n2. Invoice #123 emailed to john@acme.com successfully",
    "isMultiStep": true,
    "totalSteps": 2,
    "completedSteps": 2,
    "failedSteps": 0,
    "workflowSteps": [
      "Step 1: createInvoice - Completed",
      "Step 2: emailInvoicePdf - Completed"
    ]
  }
}
```

## Testing

### Run Multi-Step Workflow Tests
```bash
# Navigate to project root
cd /path/to/invoice-bot

# Run the multi-step workflow tests
npm test -- tests/multi-step-workflow.test.ts
```

### Example Test Cases

**Test 1: Create and Email**
```
Input: "create an invoice for $500 for Amy's Bird Sanctuary and email it to test@example.com"
Expected: 2 steps, both completed
```

**Test 2: Find and Update**
```
Input: "find invoice 123 and update the amount to $600"
Expected: 2 steps, getInvoice then updateInvoice
```

**Test 3: Complex Workflow**
```
Input: "list all unpaid invoices then create a new invoice for $1000 for Test Customer and email it to admin@test.com"
Expected: 3 steps, listInvoices, createInvoice, emailInvoicePdf
```

## Key Implementation Details

### Multi-Step Detection Logic
```typescript
const isMultiStep = messageLower.includes('and') || 
                   messageLower.includes('then') || 
                   messageLower.includes('after') ||
                   (messageLower.includes('create') && messageLower.includes('email')) ||
                   (messageLower.includes('update') && (messageLower.includes('send') || messageLower.includes('email'))) ||
                   (messageLower.includes('find') && messageLower.includes('update')) ||
                   (messageLower.includes('get') && (messageLower.includes('update') || messageLower.includes('delete')));
```

### Step Tracking
```typescript
onStepFinish: ({ text, toolCalls, toolResults }) => {
  if (toolCalls && toolCalls.length > 0) {
    toolCalls.forEach((call, index) => {
      const toolResult = toolResults?.[index];
      const stepDescription = `Step ${workflowSteps.length + 1}: ${call.toolName}`;
      const hasError = toolResult?.result && typeof toolResult.result === 'object' && 'error' in toolResult.result;
      const stepStatus = hasError ? 'Failed' : 'Completed';
      workflowSteps.push(`${stepDescription} - ${stepStatus}`);
    });
  }
}
```

### UI State Management
```typescript
// Each tool call updates the UI state appropriately
for (const toolCall of result.toolCalls) {
  const toolResult = result.toolResults?.find((tr: any) => tr.toolCallId === toolCall.toolCallId);
  
  // Process tool result and update UI
  if (toolCall.toolName === 'createInvoice') {
    // Add new invoice to list and select it
    setInvoices(prev => [newInvoice, ...prev]);
    setSelectedInvoiceId(newInvoice.Id);
    setSelectedInvoice(newInvoice);
  }
  // ... other tool types
}
```

## Benefits

1. **Seamless User Experience**: Users can request complex operations in natural language
2. **Efficient Operations**: Multiple related tasks are completed in one request
3. **Clear Feedback**: Step-by-step progress is clearly communicated
4. **Robust Error Handling**: Failures are handled gracefully with clear messages
5. **Flexible Patterns**: Supports any combination of CRUD operations without hardcoding

## Future Enhancements

1. **Parallel Steps**: Support for steps that can run in parallel
2. **Conditional Logic**: Support for if-then logic in workflows
3. **Workflow Templates**: Pre-defined workflow patterns
4. **Workflow History**: Track and replay previous multi-step operations
5. **Advanced Error Recovery**: Retry mechanisms and alternative paths 