"use client";

import React, { useEffect, useState, useRef } from "react";
import styles from "./page.module.css";

interface InvoiceSummary {
  Id: string;
  DocNumber?: string;
  [key: string]: any;
}

interface InvoiceDetail {
  Id: string;
  DocNumber?: string;
  CustomerRef?: { name: string };
  TxnDate?: string;
  TotalAmt?: number;
  Line?: any[];
  [key: string]: any;
}

interface ChatMessage {
  role: "user" | "ai";
  content: string;
  streaming?: boolean;
}

export default function HomePage() {
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "ai", content: "Hello! How can I help you with your invoices?" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const invoiceSliderRef = useRef<HTMLDivElement>(null);

  // On mount, check QuickBooks authentication
  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/quickbooks/company-info");
        const data = await res.json();
        if (data.error && data.error.toLowerCase().includes("not authenticated")) {
          window.location.href = "/api/auth/quickbooks/login";
        } else {
          setCheckingAuth(false);
        }
      } catch {
        // On error, assume not authenticated
        window.location.href = "/api/auth/quickbooks/login";
      }
    }
    checkAuth();
  }, []);

  // Initialize empty invoices array
  useEffect(() => {
    setInvoices([]);
    setLoading(false);
    setError(null);
    setAuthError(false);
  }, []);

  // Set invoice details when selectedInvoiceId changes
  useEffect(() => {
    if (!selectedInvoiceId) {
      setSelectedInvoice(null);
      return;
    }
    
    // Find the invoice in the already loaded invoices array
    const foundInvoice = invoices.find(inv => inv.Id === selectedInvoiceId);
    if (foundInvoice) {
      setSelectedInvoice(foundInvoice);
      setLoading(false);
      setError(null);
    } else {
      // If not found in loaded invoices, fetch via AI
      setLoading(true);
      setError(null);
      
      const fetchInvoice = async () => {
        try {
          const res = await fetch("/api/ai/invoice-tool", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: `get invoice ${selectedInvoiceId}` }),
          });
          const data = await res.json();
          
          if (!res.ok) {
            setError(data.error || "Failed to fetch invoice details");
            setSelectedInvoice(null);
          } else {
            // Extract invoice from AI response
            const result = data.result;
            if (result?.toolResults) {
              const toolResult = result.toolResults.find((tr: any) => tr.result);
              if (toolResult?.result) {
                const invoice = toolResult.result?.QueryResponse?.Invoice?.[0] || toolResult.result;
                setSelectedInvoice(invoice);
              }
            }
          }
        } catch (err: any) {
          setError(err.message || "Failed to fetch invoice details");
          setSelectedInvoice(null);
        } finally {
          setLoading(false);
        }
      };
      
      fetchInvoice();
    }
  }, [selectedInvoiceId, invoices]);

  // Scroll chat to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  // Handle slider navigation
  const scrollInvoiceSlider = (direction: 'left' | 'right') => {
    if (invoiceSliderRef.current) {
      const scrollAmount = 300; // Width of one card plus gap
      const currentScroll = invoiceSliderRef.current.scrollLeft;
      const newScroll = direction === 'left' 
        ? currentScroll - scrollAmount 
        : currentScroll + scrollAmount;
      
      invoiceSliderRef.current.scrollTo({
        left: newScroll,
        behavior: 'smooth'
      });
    }
  };

  // Simulate streaming of AI response
  const streamAIResponse = async (fullText: string) => {
    let current = "";
    setChatMessages((msgs) => [
      ...msgs,
      { role: "ai", content: "", streaming: true },
    ]);
    const words = fullText.split(" ");
    for (let i = 0; i < words.length; i++) {
      current += (i === 0 ? "" : " ") + words[i];
      setChatMessages((msgs) => {
        const last = msgs[msgs.length - 1];
        if (last && last.streaming) {
          return [
            ...msgs.slice(0, -1),
            { ...last, content: current },
          ];
        }
        return msgs;
      });
      await new Promise((r) => setTimeout(r, 30)); // 30ms per word
    }
    // Remove streaming flag
    setChatMessages((msgs) => {
      const last = msgs[msgs.length - 1];
      if (last && last.streaming) {
        return [
          ...msgs.slice(0, -1),
          { ...last, content: current, streaming: false },
        ];
      }
      return msgs;
    });
    // If the AI response mentions an invoice, auto-select it
    const match = fullText.match(/Invoice #(\d+)/i);
    if (match) {
      // Try to find by DocNumber or Id
      const docNum = match[1];
      const found = invoices.find(
        (inv) => inv.DocNumber === docNum || inv.Id === docNum
      );
      if (found) setSelectedInvoiceId(found.Id);
    }
  };

  // Handle chat form submit
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const userMessage = chatInput.trim();
    setChatMessages((msgs) => [...msgs, { role: "user", content: userMessage }]);
    setChatInput("");
    setChatLoading(true);
    try {
      // Send the user message as { message: userMessage }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for QuickBooks API
      
      const res = await fetch("/api/ai/invoice-tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) {
        await streamAIResponse(data.error || "Sorry, I couldn't process your request.");
      } else {
        // Check if the response contains invoice data and populate left panel
        const result = data.result;
        let responseText = result?.text || "";
        let invoiceDataFound = false;
        

        


        // Helper function to parse invoice data from text response
        const parseInvoicesFromText = (text: string) => {
          if (!text) return null;
          
          const invoices = [];
          
          // Pattern for the single-line format in chat (with optional Status)
          // Matches: "1. **Invoice ID:** 145 - **Customer:** Amy's Bird Sanctuary - **Date:** 2025-07-08 - **Due Date:** 2025-08-07 - **Total Amount:** $560 - **Balance:** $560 - **Status:** Need to Print"
          const singleLinePattern = /\d+\.\s*\*\*Invoice ID:\*\*\s*(\d+)\s*-\s*\*\*Customer:\*\*\s*([^-]+?)\s*-\s*\*\*Date:\*\*\s*([\d-]+)\s*-\s*\*\*Due Date:\*\*\s*([\d-]+)\s*-\s*\*\*Total Amount:\*\*\s*\$?([\d.]+)\s*-\s*\*\*Balance:\*\*\s*\$?([\d.]+)(?:\s*-\s*\*\*Status:\*\*\s*[^0-9]+)?/g;
          
          let match;
          while ((match = singleLinePattern.exec(text)) !== null) {
            if (match && match.length >= 7) {
              const invoice = {
                Id: match[1] || '',
                DocNumber: match[1] || '', // Using ID as DocNumber since DocNumber is not in this format
                TxnDate: match[3] || '', // Date is at position 3
                CustomerRef: {
                  name: match[2]?.trim() || ''
                },
                TotalAmt: parseFloat(match[5] || '0'),
                DueDate: match[4] || '',
                Balance: parseFloat(match[6] || '0')
              };
              invoices.push(invoice);
            }
          }
          
          // If single-line pattern didn't work, try the multi-line structured format
          if (invoices.length === 0) {
            const multiLinePattern = /\d+\.\s*\*\*Invoice ID:\*\*\s*(\d+)[\s\S]*?-\s*\*\*Doc Number:\*\*\s*(\d+)[\s\S]*?-\s*\*\*Customer:\*\*\s*([^\n-]+?)[\s\S]*?-\s*\*\*Total Amount:\*\*\s*\$?([\d.]+)[\s\S]*?-\s*\*\*Due Date:\*\*\s*([\d-]+)[\s\S]*?-\s*\*\*Balance:\*\*\s*\$?([\d.]+)/g;
            
            while ((match = multiLinePattern.exec(text)) !== null) {
              if (match && match.length >= 7) {
                const invoice = {
                  Id: match[1] || '',
                  DocNumber: match[2] || '',
                  TxnDate: match[5] || '',
                  CustomerRef: {
                    name: match[3]?.trim() || ''
                  },
                  TotalAmt: parseFloat(match[4] || '0'),
                  DueDate: match[5] || '',
                  Balance: parseFloat(match[6] || '0')
                };
                invoices.push(invoice);
              }
            }
          }
          
          // If still no invoices, try the basic structured format
          if (invoices.length === 0) {
            const basicPattern = /\*\*Invoice ID:\*\*\s*(\d+)[\s\S]*?\*\*Customer:\*\*\s*([^\n*]+)[\s\S]*?\*\*Total Amount:\*\*\s*\$?([\d.]+)[\s\S]*?\*\*Due Date:\*\*\s*([\d-]+)[\s\S]*?\*\*Balance:\*\*\s*\$?([\d.]+)/g;
            
            while ((match = basicPattern.exec(text)) !== null) {
              if (match && match.length >= 6) {
                const invoice = {
                  Id: match[1] || '',
                  DocNumber: match[1] || '',
                  TxnDate: match[4] || '',
                  CustomerRef: {
                    name: match[2]?.trim() || ''
                  },
                  TotalAmt: parseFloat(match[3] || '0'),
                  DueDate: match[4] || '',
                  Balance: parseFloat(match[5] || '0')
                };
                invoices.push(invoice);
              }
            }
          }
          
          return invoices.length > 0 ? invoices : null;
        };

        // Helper function to extract invoice data from various response formats
        const extractInvoiceData = (data: any) => {
          if (!data) return null;
          
          // Try different possible locations for invoice data
          const possiblePaths = [
            data?.QueryResponse?.Invoice,
            data?.Invoice,
            data?.result?.QueryResponse?.Invoice,
            data?.result?.Invoice,
            data?.result,
            data?.toolResults?.[0]?.result?.QueryResponse?.Invoice,
            data?.toolResults?.[0]?.result?.Invoice,
            data?.toolResults?.[0]?.result,
            data
          ];
          
          for (let i = 0; i < possiblePaths.length; i++) {
            const path = possiblePaths[i];
            
            if (path) {
              if (Array.isArray(path)) {
                // Filter out any non-invoice objects
                const invoices = path.filter(item => item && typeof item === 'object' && item.Id);
                if (invoices.length > 0) return invoices;
              } else if (path && typeof path === 'object' && path.Id) {
                return [path];
              }
            }
          }
          
          // If direct paths don't work, try to find invoices in nested structures
          const searchForInvoices = (obj: any): any[] => {
            if (!obj || typeof obj !== 'object') return [];
            
            let found: any[] = [];
            
            // Check if current object is an invoice
            if (obj.Id && (obj.DocNumber !== undefined || obj.TotalAmt !== undefined || obj.CustomerRef)) {
              found.push(obj);
            }
            
            // Recursively search in nested objects/arrays
            for (const key in obj) {
              if (obj.hasOwnProperty(key)) {
                const value = obj[key];
                if (Array.isArray(value)) {
                  found = found.concat(value.filter(item => 
                    item && typeof item === 'object' && item.Id && 
                    (item.DocNumber !== undefined || item.TotalAmt !== undefined || item.CustomerRef)
                  ));
                } else if (value && typeof value === 'object') {
                  found = found.concat(searchForInvoices(value));
                }
              }
            }
            
            return found;
          };
          
          const foundInvoices = searchForInvoices(data);
          return foundInvoices.length > 0 ? foundInvoices : null;
        };

        // Check for tool calls that returned results
        if (result?.toolCalls) {
          // First check if any tool calls have errors to prevent infinite loops
          const hasErrors = result.toolResults?.some((tr: any) => tr.result?.error);
          
          if (hasErrors) {
            const errorResult = result.toolResults?.find((tr: any) => tr.result?.error);
            invoiceDataFound = true;
            responseText = `Error: ${errorResult?.result?.error || 'Unknown error occurred'}`;
          } else {
            for (const toolCall of result.toolCalls) {
              const toolResult = result.toolResults?.find((tr: any) => tr.toolCallId === toolCall.toolCallId);
            
            if (toolCall.toolName === 'listInvoices' || toolCall.toolName === 'getInvoice') {
              if (toolResult?.result) {
                // Check if there's an error in the tool result
                if (toolResult.result.error) {
                  invoiceDataFound = true;
                  responseText = `Error retrieving invoices: ${toolResult.result.error}`;
                } else {
                  // Extract invoice data using the helper function
                  const extractedInvoices = extractInvoiceData(toolResult.result);
                  
                  if (extractedInvoices && extractedInvoices.length > 0) {
                    invoiceDataFound = true;
                    
                    if (toolCall.toolName === 'listInvoices') {
                      // Handle list invoices response - always set invoices in cards
                      setInvoices(extractedInvoices);
                      responseText = `Found ${extractedInvoices.length} unpaid invoice(s). Check the invoices panel to view them.`;
                    } else if (toolCall.toolName === 'getInvoice') {
                      // Handle single invoice response
                      const invoice = extractedInvoices[0];
                      if (invoice && invoice.Id) {
                        setSelectedInvoiceId(invoice.Id);
                        setSelectedInvoice(invoice);
                        // Add to invoices list if not already there
                        setInvoices(prev => {
                          const exists = prev.find(inv => inv.Id === invoice.Id);
                          return exists ? prev : [invoice, ...prev];
                        });
                        responseText = `Invoice #${invoice.DocNumber || invoice.Id} details loaded. Check the invoices panel to view details.`;
                      }
                    }
                  } else {
                    responseText = toolCall.toolName === 'listInvoices' 
                      ? "No invoices found matching your criteria." 
                      : "Invoice not found.";
                  }
                }
              } else {
                invoiceDataFound = true;
                responseText = `Error: Unable to retrieve invoice data. Please try again.`;
              }
            } else if (toolCall.toolName === 'deleteInvoice') {
              invoiceDataFound = true;
              if (toolResult?.result && !toolResult.result.error) {
                const invoiceId = toolCall.args?.invoiceId;
                // Remove deleted invoice from the list
                setInvoices(prev => prev.filter(inv => inv.Id !== invoiceId));
                // Clear selection if the deleted invoice was selected
                if (selectedInvoiceId === invoiceId) {
                  setSelectedInvoiceId('');
                  setSelectedInvoice(null);
                }
                responseText = `Invoice #${invoiceId} has been successfully deleted.`;
              } else {
                responseText = `Failed to delete invoice: ${toolResult?.result?.error || 'Unknown error'}`;
              }
            } else if (toolCall.toolName === 'createInvoice') {
              invoiceDataFound = true;
              if (toolResult?.result && !toolResult.result.error) {
                const newInvoice = toolResult.result?.QueryResponse?.Invoice?.[0] || toolResult.result;
                if (newInvoice && newInvoice.Id) {
                  // Add new invoice to the list
                  setInvoices(prev => [newInvoice, ...prev]);
                  setSelectedInvoiceId(newInvoice.Id);
                  setSelectedInvoice(newInvoice);
                  responseText = `Invoice #${newInvoice.DocNumber || newInvoice.Id} has been successfully created.`;
                } else {
                  responseText = "Invoice created successfully.";
                }
              } else {
                responseText = `Failed to create invoice: ${toolResult?.result?.error || 'Unknown error'}`;
              }
            } else if (toolCall.toolName === 'updateInvoice') {
              invoiceDataFound = true;
              if (toolResult?.result && !toolResult.result.error) {
                const updatedInvoice = toolResult.result?.QueryResponse?.Invoice?.[0] || toolResult.result;
                if (updatedInvoice && updatedInvoice.Id) {
                  // Update invoice in the list
                  setInvoices(prev => prev.map(inv => 
                    inv.Id === updatedInvoice.Id ? updatedInvoice : inv
                  ));
                  // Update selected invoice if it's the one that was updated
                  if (selectedInvoiceId === updatedInvoice.Id) {
                    setSelectedInvoice(updatedInvoice);
                  }
                  responseText = `Invoice #${updatedInvoice.DocNumber || updatedInvoice.Id} has been successfully updated.`;
                } else {
                  responseText = "Invoice updated successfully.";
                }
              } else {
                responseText = `Failed to update invoice: ${toolResult?.result?.error || 'Unknown error'}`;
              }
            } else if (toolCall.toolName === 'emailInvoicePdf') {
              invoiceDataFound = true;
              if (toolResult?.result && !toolResult.result.error) {
                const invoiceId = toolCall.args?.invoiceId;
                const email = toolCall.args?.email;
                responseText = `Invoice #${invoiceId} has been successfully emailed to ${email}.`;
              } else {
                responseText = `Failed to email invoice: ${toolResult?.result?.error || 'Unknown error'}`;
              }
            }
          }
        }
      }

        // If no invoice data was found in tool calls, check for direct invoice data in response
        if (!invoiceDataFound) {
          // Try to extract invoice data from the main result
          const directInvoiceData = extractInvoiceData(result);
          
          if (directInvoiceData && directInvoiceData.length > 0) {
            invoiceDataFound = true;
            
            // Check if it's a single invoice or multiple invoices
            if (directInvoiceData.length === 1) {
              const invoice = directInvoiceData[0];
              setSelectedInvoiceId(invoice.Id);
              setSelectedInvoice(invoice);
              // Add to invoices list if not already there
              setInvoices(prev => {
                const exists = prev.find(inv => inv.Id === invoice.Id);
                return exists ? prev : [invoice, ...prev];
              });
              responseText = `Invoice #${invoice.DocNumber || invoice.Id} details loaded. Check the invoices panel to view details.`;
            } else {
              // Multiple invoices
              setInvoices(directInvoiceData);
              responseText = `Found ${directInvoiceData.length} invoice(s). Check the invoices panel to view them.`;
            }
          } else {
            // Check if the user's message suggests they want invoice data
            const userMessageLower = userMessage.toLowerCase();
            const invoiceKeywords = ['invoice', 'invoices', 'show', 'list', 'get', 'find', 'display'];
            const containsInvoiceKeywords = invoiceKeywords.some(keyword => userMessageLower.includes(keyword));
            
            if (containsInvoiceKeywords && result?.text) {
              // If the response text contains invoice information, try to parse it
              const parsedInvoices = parseInvoicesFromText(result.text);
              
              if (parsedInvoices && parsedInvoices.length > 0) {
                invoiceDataFound = true;
                setInvoices(parsedInvoices);
                responseText = `Found ${parsedInvoices.length} invoice(s). Check the invoices panel to view them.`;
              }
            }
          }
        }

        // If no invoice data was found, show the original response
        if (!invoiceDataFound) {
          responseText = result?.text || JSON.stringify(result);
        }

        await streamAIResponse(responseText);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        await streamAIResponse("Request timed out. QuickBooks operations can take up to a minute. Please try again or use a more specific query.");
      } else {
        await streamAIResponse(err.message || "Sorry, something went wrong.");
      }
    } finally {
      setChatLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <main className={styles.mainContainer}>
        <div className={styles.panelsWrapper}>
          <section className={styles.leftPanel}>
            <h2 className={styles.panelTitle}>Invoices</h2>
            <div className={styles.invoiceListWrapper}>
              <p>Checking QuickBooks authentication...</p>
            </div>
            <div className={styles.invoiceDetail}>
              <h3 className={styles.invoiceDetailTitle}>Invoice Details</h3>
              <p className={styles.invoiceDetailText}>Select an invoice to view details.</p>
            </div>
          </section>
          <section className={styles.rightPanel}>
            <h2 className={styles.panelTitle}>AI Chat</h2>
            <div className={styles.chatContainer}>
              <div className={styles.chatMessageAI}>Checking QuickBooks authentication...</div>
            </div>
            <form className={styles.chatInputForm}>
              <input 
                type="text" 
                className={styles.chatInput} 
                value=""
                readOnly
                disabled 
              />
              <button type="submit" className={styles.chatSendButton} disabled>Send</button>
            </form>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.mainContainer}>
      <div className={styles.panelsWrapper}>
        {/* Left Panel: Invoice List + Detail */}
        <section className={styles.leftPanel}>
          <h2 className={styles.panelTitle}>Invoices</h2>
          {/* Auth error: show connect button */}
          {authError ? (
            <div style={{ textAlign: "center" }}>
              <p style={{ color: "#e11d48", marginBottom: 16 }}>Not connected to QuickBooks.</p>
              <a href="/api/auth/quickbooks/login" className={styles.chatSendButton} style={{ textDecoration: "none" }}>
                Connect to QuickBooks
              </a>
            </div>
          ) : loading ? (
            <div className={styles.invoiceCardsContainer}>
              <div className={styles.noInvoicesMessage}>
                <p>Loading invoices...</p>
              </div>
            </div>
          ) : error ? (
            <div className={styles.invoiceCardsContainer}>
              <div className={styles.noInvoicesMessage}>
                <p style={{ color: "#e11d48" }}>{error}</p>
              </div>
            </div>
          ) : (
                        <div className={styles.invoiceCardsContainer}>
              {invoices.length === 0 ? (
                <div className={styles.noInvoicesMessage}>
                  <p>No invoices loaded. Ask the AI to "show invoices" or "list invoices".</p>
                </div>
              ) : (
                <div className={styles.invoiceSliderWrapper}>
                  <button 
                    className={`${styles.sliderButton} ${styles.sliderButtonLeft}`}
                    onClick={() => scrollInvoiceSlider('left')}
                    aria-label="Previous invoices"
                  >
                    ‹
                  </button>
                  <div className={styles.invoiceCardsSlider} ref={invoiceSliderRef}>
                    {invoices.map((inv) => (
                      <div
                        key={inv.Id}
                        className={`${styles.invoiceCard} ${inv.Id === selectedInvoiceId ? styles.invoiceCardActive : ''}`}
                        onClick={() => setSelectedInvoiceId(inv.Id)}
                      >
                        <div className={styles.invoiceCardHeader}>
                          <h4 className={styles.invoiceCardNumber}>#{inv.DocNumber || inv.Id}</h4>
                          <span className={styles.invoiceCardAmount}>
                            ${inv.TotalAmt ? Number(inv.TotalAmt).toFixed(2) : '0.00'}
                          </span>
                        </div>
                        <div className={styles.invoiceCardInfo}>
                          <p className={styles.invoiceCardCustomer}>
                            {inv.CustomerRef?.name || 'Unknown Customer'}
                          </p>
                          <p className={styles.invoiceCardDate}>
                            {inv.TxnDate ? new Date(inv.TxnDate).toLocaleDateString() : 'No date'}
                          </p>
                        </div>
                        <div className={styles.invoiceCardStatus}>
                          <span className={`${styles.statusBadge} ${(inv.Balance && Number(inv.Balance) > 0) ? styles.statusPending : styles.statusPaid}`}>
                            {(inv.Balance && Number(inv.Balance) > 0) ? 'Pending' : 'Paid'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button 
                    className={`${styles.sliderButton} ${styles.sliderButtonRight}`}
                    onClick={() => scrollInvoiceSlider('right')}
                    aria-label="Next invoices"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          )}
          {/* Invoice Detail */}
          <div className={styles.invoiceDetail}>
            <h3 className={styles.invoiceDetailTitle}>Invoice Details</h3>
            {selectedInvoice ? (
              <div>
                <div style={{ marginBottom: 8 }}>
                  <strong>ID:</strong> {selectedInvoice.Id}<br />
                  <strong>Number:</strong> {selectedInvoice.DocNumber}<br />
                  <strong>Customer:</strong> {selectedInvoice.CustomerRef?.name || "-"}<br />
                  <strong>Date:</strong> {selectedInvoice.TxnDate || "-"}<br />
                  <strong>Total:</strong> ${selectedInvoice.TotalAmt?.toFixed(2) || "-"}
                </div>
                <div>
                  <strong>Line Items:</strong>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {selectedInvoice.Line?.map((line, idx) => (
                      <li key={idx}>{line.Description || line.DetailType || "Line Item"}</li>
                    )) || <li>No line items</li>}
                  </ul>
                </div>
              </div>
            ) : (
              <p className={styles.invoiceDetailText}>
                {selectedInvoiceId ? "Loading details..." : "Select an invoice to view details."}
              </p>
            )}
          </div>
        </section>

        {/* Right Panel: AI Chat */}
        <section className={styles.rightPanel}>
          <h2 className={styles.panelTitle}>AI Chat</h2>
          <div className={styles.chatContainer} ref={chatContainerRef}>
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={
                  msg.role === "user"
                    ? styles.chatMessageUser
                    : styles.chatMessageAI + (msg.streaming ? " " + styles.chatMessageLoading : "")
                }
              >
                {msg.content}
              </div>
            ))}
            {chatLoading && !chatMessages[chatMessages.length - 1]?.streaming && (
              <div className={styles.chatMessageAI + " " + styles.chatMessageLoading}>
                Thinking...
              </div>
            )}
          </div>
          <form className={styles.chatInputForm} onSubmit={handleChatSubmit} autoComplete="off">
            <input
              type="text"
              placeholder="Type your message..."
              className={styles.chatInput}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatLoading}
            />
            <button
              type="submit"
              className={styles.chatSendButton}
              disabled={chatLoading || !chatInput.trim()}
            >
              Send
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
