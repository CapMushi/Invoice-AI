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
      const res = await fetch("/api/ai/invoice-tool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });
      const data = await res.json();
      if (!res.ok) {
        await streamAIResponse(data.error || "Sorry, I couldn't process your request.");
      } else {
        // Check if the response contains invoice data and populate left panel
        const result = data.result;
        let responseText = result?.text || "";
        let invoiceDataFound = false;

        // Check for tool calls that returned results
        if (result?.toolCalls) {
          for (const toolCall of result.toolCalls) {
            const toolResult = result.toolResults?.find((tr: any) => tr.toolCallId === toolCall.toolCallId);
            
            if (toolCall.toolName === 'listInvoices' || toolCall.toolName === 'getInvoice') {
              if (toolResult?.result) {
                invoiceDataFound = true;
                if (toolCall.toolName === 'listInvoices') {
                  // Handle list invoices response
                  const invoiceList = toolResult.result?.QueryResponse?.Invoice || [];
                  if (invoiceList.length > 0) {
                    setInvoices(invoiceList);
                    responseText = `Found ${invoiceList.length} invoice(s). Check the invoices panel to view them.`;
                  } else {
                    responseText = "No invoices found in your QuickBooks account.";
                  }
                } else if (toolCall.toolName === 'getInvoice') {
                  // Handle single invoice response
                  const invoice = toolResult.result?.QueryResponse?.Invoice?.[0] || toolResult.result;
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

        // If no invoice data was found, show the original response
        if (!invoiceDataFound) {
          responseText = result?.text || JSON.stringify(result);
        }

        await streamAIResponse(responseText);
      }
    } catch (err: any) {
      await streamAIResponse(err.message || "Sorry, something went wrong.");
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
