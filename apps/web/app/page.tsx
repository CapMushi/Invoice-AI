"use client";

import React, { useEffect, useState, useRef } from "react";
import styles from "./page.module.css";
import AuthGuard from "../components/auth/AuthGuard";
import { useAuth } from "../components/auth/AuthProvider";

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
  const { user, profile, signOut } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);

  // Debug logging when invoices state changes
  // useEffect(() => {
  //   console.log('🔍 Invoices state changed:', invoices);
  // }, [invoices]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    null,
  );
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Modal state
  const [showAllInvoicesModal, setShowAllInvoicesModal] = useState(false);
  const [modalCurrentIndex, setModalCurrentIndex] = useState(0);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "ai", content: "Hello! How can I help you with your invoices?" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const invoiceSliderRef = useRef<HTMLDivElement>(null);

  // On mount, check QuickBooks authentication with retry logic
  useEffect(() => {
    async function checkAuth(retryCount = 0) {
      try {
        // First try the hybrid auth check endpoint
        let res, data;
        const localTokens = localStorage.getItem("quickbooks_tokens");

        if (localTokens) {
          console.log(
            "🔍 Found localStorage tokens, using hybrid auth check...",
          );
          res = await fetch("/api/auth/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tokens: JSON.parse(localTokens) }),
          });
          data = await res.json();

          if (!data.authenticated) {
            console.log(
              "🔍 Hybrid auth failed, falling back to company-info endpoint...",
            );
            res = await fetch("/api/quickbooks/company-info");
            data = await res.json();
          }
        } else {
          console.log(
            "🔍 No localStorage tokens, using company-info endpoint...",
          );
          res = await fetch("/api/quickbooks/company-info");
          data = await res.json();
        }
        if (
          data.error &&
          data.error.toLowerCase().includes("not authenticated")
        ) {
          // If we just came back from OAuth, retry a few times
          const urlParams = new URLSearchParams(window.location.search);
          const authSuccess = urlParams.get("auth") === "success";
          if (
            (urlParams.has("code") || urlParams.has("state") || authSuccess) &&
            retryCount < 5
          ) {
            console.log(
              `🔍 Auth failed but OAuth params detected, retrying in 2s... (attempt ${retryCount + 1})`,
            );
            setTimeout(() => checkAuth(retryCount + 1), 2000);
            return;
          }
          setAuthError(true);
          setCheckingAuth(false);
        } else {
          setCheckingAuth(false);
          // Clear URL parameters after successful authentication
          const urlParams = new URLSearchParams(window.location.search);
          if (
            urlParams.has("code") ||
            urlParams.has("state") ||
            urlParams.has("auth")
          ) {
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname,
            );
          }
        }
      } catch {
        // On error, retry if we might be in OAuth flow
        const urlParams = new URLSearchParams(window.location.search);
        const authSuccess = urlParams.get("auth") === "success";
        if (
          (urlParams.has("code") || urlParams.has("state") || authSuccess) &&
          retryCount < 5
        ) {
          console.log(
            `🔍 Auth error but OAuth params detected, retrying in 2s... (attempt ${retryCount + 1})`,
          );
          setTimeout(() => checkAuth(retryCount + 1), 2000);
          return;
        }
        setAuthError(true);
        setCheckingAuth(false);
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
    const foundInvoice = invoices.find((inv) => inv.Id === selectedInvoiceId);
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
            body: JSON.stringify({
              message: `get invoice ${selectedInvoiceId}`,
            }),
          });
          const data = await res.json();

          if (!res.ok) {
            setError(data.error || "Failed to fetch invoice details");
            setSelectedInvoice(null);
          } else {
            // Extract invoice from AI response
            const result = data.result;
            if (result?.toolResults) {
              const toolResult = result.toolResults.find(
                (tr: any) => tr.result,
              );
              if (toolResult?.result) {
                const invoice =
                  toolResult.result?.QueryResponse?.Invoice?.[0] ||
                  toolResult.result;
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
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  // Handle slider navigation
  const scrollInvoiceSlider = (direction: "left" | "right") => {
    if (invoiceSliderRef.current) {
      const scrollAmount = 300; // Width of one card plus gap
      const currentScroll = invoiceSliderRef.current.scrollLeft;
      const newScroll =
        direction === "left"
          ? currentScroll - scrollAmount
          : currentScroll + scrollAmount;

      invoiceSliderRef.current.scrollTo({
        left: newScroll,
        behavior: "smooth",
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
          return [...msgs.slice(0, -1), { ...last, content: current }];
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
        (inv) => inv.DocNumber === docNum || inv.Id === docNum,
      );
      if (found) setSelectedInvoiceId(found.Id);
    }
  };

  // Handle chat form submit
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const userMessage = chatInput.trim();
    setChatMessages((msgs) => [
      ...msgs,
      { role: "user", content: userMessage },
    ]);
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
        await streamAIResponse(
          data.error || "Sorry, I couldn't process your request.",
        );
      } else {
        // Check if the response contains invoice data and populate left panel
        const result = data.result;
        let responseText = result?.text || "";
        let invoiceDataFound = false;

        // Handle multi-step workflow display
        let workflowText = "";
        if (
          result?.isMultiStep &&
          result?.workflowSteps &&
          result.workflowSteps.length > 0
        ) {
          workflowText = `\n\n**Workflow Progress:**\n${result.workflowSteps.map((step: string, index: number) => `${index + 1}. ${step}`).join("\n")}\n\n`;
        }

        // Debug logging to understand the response structure
        console.log("🔍 API Response:", data);
        console.log("🔍 Result:", result);
        console.log("🔍 Tool Calls:", result?.toolCalls);
        console.log("🔍 Tool Results:", result?.toolResults);

        // Helper function to parse invoice data from text response
        const parseInvoicesFromText = (text: string) => {
          if (!text) return null;

          const invoices = [];

          // Pattern for the single-line format in chat (with optional Status)
          // Matches: "1. **Invoice ID:** 145 - **Customer:** Amy's Bird Sanctuary - **Date:** 2025-07-08 - **Due Date:** 2025-08-07 - **Total Amount:** $560 - **Balance:** $560 - **Status:** Need to Print"
          const singleLinePattern =
            /\d+\.\s*\*\*Invoice ID:\*\*\s*(\d+)\s*-\s*\*\*Customer:\*\*\s*([^-]+?)\s*-\s*\*\*Date:\*\*\s*([\d-]+)\s*-\s*\*\*Due Date:\*\*\s*([\d-]+)\s*-\s*\*\*Total Amount:\*\*\s*\$?([\d.]+)\s*-\s*\*\*Balance:\*\*\s*\$?([\d.]+)(?:\s*-\s*\*\*Status:\*\*\s*[^0-9]+)?/g;

          let match;
          while ((match = singleLinePattern.exec(text)) !== null) {
            if (match && match.length >= 7) {
              const invoice = {
                Id: match[1] || "",
                DocNumber: match[1] || "", // Using ID as DocNumber since DocNumber is not in this format
                TxnDate: match[3] || "", // Date is at position 3
                CustomerRef: {
                  name: match[2]?.trim() || "",
                },
                TotalAmt: parseFloat(match[5] || "0"),
                DueDate: match[4] || "",
                Balance: parseFloat(match[6] || "0"),
              };
              invoices.push(invoice);
            }
          }

          // If single-line pattern didn't work, try the multi-line structured format
          if (invoices.length === 0) {
            const multiLinePattern =
              /\d+\.\s*\*\*Invoice ID:\*\*\s*(\d+)[\s\S]*?-\s*\*\*Doc Number:\*\*\s*(\d+)[\s\S]*?-\s*\*\*Customer:\*\*\s*([^\n-]+?)[\s\S]*?-\s*\*\*Total Amount:\*\*\s*\$?([\d.]+)[\s\S]*?-\s*\*\*Due Date:\*\*\s*([\d-]+)[\s\S]*?-\s*\*\*Balance:\*\*\s*\$?([\d.]+)/g;

            while ((match = multiLinePattern.exec(text)) !== null) {
              if (match && match.length >= 7) {
                const invoice = {
                  Id: match[1] || "",
                  DocNumber: match[2] || "",
                  TxnDate: match[5] || "",
                  CustomerRef: {
                    name: match[3]?.trim() || "",
                  },
                  TotalAmt: parseFloat(match[4] || "0"),
                  DueDate: match[5] || "",
                  Balance: parseFloat(match[6] || "0"),
                };
                invoices.push(invoice);
              }
            }
          }

          // If still no invoices, try the basic structured format
          if (invoices.length === 0) {
            const basicPattern =
              /\*\*Invoice ID:\*\*\s*(\d+)[\s\S]*?\*\*Customer:\*\*\s*([^\n*]+)[\s\S]*?\*\*Total Amount:\*\*\s*\$?([\d.]+)[\s\S]*?\*\*Due Date:\*\*\s*([\d-]+)[\s\S]*?\*\*Balance:\*\*\s*\$?([\d.]+)/g;

            while ((match = basicPattern.exec(text)) !== null) {
              if (match && match.length >= 6) {
                const invoice = {
                  Id: match[1] || "",
                  DocNumber: match[1] || "",
                  TxnDate: match[4] || "",
                  CustomerRef: {
                    name: match[2]?.trim() || "",
                  },
                  TotalAmt: parseFloat(match[3] || "0"),
                  DueDate: match[4] || "",
                  Balance: parseFloat(match[5] || "0"),
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
            data,
          ];

          for (let i = 0; i < possiblePaths.length; i++) {
            const path = possiblePaths[i];

            if (path) {
              if (Array.isArray(path)) {
                // Filter out any non-invoice objects
                const invoices = path.filter(
                  (item) => item && typeof item === "object" && item.Id,
                );
                if (invoices.length > 0) return invoices;
              } else if (path && typeof path === "object" && path.Id) {
                return [path];
              }
            }
          }

          // If direct paths don't work, try to find invoices in nested structures
          const searchForInvoices = (obj: any): any[] => {
            if (!obj || typeof obj !== "object") return [];

            let found: any[] = [];

            // Check if current object is an invoice
            if (
              obj.Id &&
              (obj.DocNumber !== undefined ||
                obj.TotalAmt !== undefined ||
                obj.CustomerRef)
            ) {
              found.push(obj);
            }

            // Recursively search in nested objects/arrays
            for (const key in obj) {
              if (obj.hasOwnProperty(key)) {
                const value = obj[key];
                if (Array.isArray(value)) {
                  found = found.concat(
                    value.filter(
                      (item) =>
                        item &&
                        typeof item === "object" &&
                        item.Id &&
                        (item.DocNumber !== undefined ||
                          item.TotalAmt !== undefined ||
                          item.CustomerRef),
                    ),
                  );
                } else if (value && typeof value === "object") {
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
          console.log("🔍 Processing tool calls:", result.toolCalls.length);

          // Handle multi-step workflow display
          let stepResults: string[] = [];
          let hasAnyToolCalls = true; // Track that we processed tool calls

          for (const toolCall of result.toolCalls) {
            const toolResult = result.toolResults?.find(
              (tr: any) => tr.toolCallId === toolCall.toolCallId,
            );
            console.log(
              `🔍 Processing tool call: ${toolCall.toolName}`,
              toolResult,
            );

            // Process each tool call and accumulate results
            let stepMessage = "";
            let stepSuccess = false;
            const hasError =
              toolResult?.result &&
              typeof toolResult.result === "object" &&
              "error" in toolResult.result;

            if (hasError) {
              console.log(
                `❌ Tool call ${toolCall.toolName} failed:`,
                (toolResult.result as any).error,
              );
              const errorMessage = (toolResult.result as any).error;

              // Handle specific error cases with user-friendly messages
              if (
                errorMessage.includes("Object Not Found") ||
                errorMessage.includes("inactive")
              ) {
                if (toolCall.toolName === "getInvoice") {
                  stepMessage = `Invoice #${toolCall.args?.invoiceId} was not found. It may have been deleted or is inactive.`;
                } else if (toolCall.toolName === "updateInvoice") {
                  stepMessage = `Cannot update invoice #${toolCall.args?.invoiceId} - it was not found or is inactive.`;
                } else if (toolCall.toolName === "deleteInvoice") {
                  stepMessage = `Cannot delete invoice #${toolCall.args?.invoiceId} - it was not found or is inactive.`;
                } else {
                  stepMessage = `Invoice operation failed: ${errorMessage}`;
                }
              } else {
                stepMessage = `Error in ${toolCall.toolName}: ${errorMessage}`;
              }
              stepSuccess = false;
            } else {
              stepSuccess = true;

              // Handle each tool type
              if (toolCall.toolName === "listInvoices") {
                const extractedInvoices =
                  toolResult.result.QueryResponse?.Invoice || [];
                console.log(
                  `🔍 listInvoices found ${extractedInvoices.length} invoices`,
                );
                if (extractedInvoices.length > 0) {
                  setInvoices(extractedInvoices);
                  stepMessage =
                    toolResult.result.summary ||
                    `Found ${extractedInvoices.length} invoices`;
                } else {
                  setInvoices([]);
                  stepMessage =
                    toolResult.result.summary || "No invoices found";
                }
              } else if (toolCall.toolName === "getInvoice") {
                const extractedInvoices = extractInvoiceData(toolResult.result);
                console.log(`🔍 getInvoice extracted:`, extractedInvoices);
                if (extractedInvoices && extractedInvoices.length > 0) {
                  const invoice = extractedInvoices[0];
                  setSelectedInvoiceId(invoice.Id);
                  setSelectedInvoice(invoice);
                  setInvoices((prev) => {
                    const exists = prev.find((inv) => inv.Id === invoice.Id);
                    return exists ? prev : [invoice, ...prev];
                  });
                  stepMessage =
                    toolResult.result.summary ||
                    `Invoice #${invoice.DocNumber || invoice.Id} retrieved`;
                } else {
                  stepMessage = "Invoice not found";
                  stepSuccess = false;
                }
              } else if (toolCall.toolName === "createInvoice") {
                const newInvoice =
                  toolResult.result?.QueryResponse?.Invoice?.[0] ||
                  toolResult.result;
                console.log(`🔍 createInvoice result:`, newInvoice);
                if (newInvoice && newInvoice.Id) {
                  setInvoices((prev) => [newInvoice, ...prev]);
                  setSelectedInvoiceId(newInvoice.Id);
                  setSelectedInvoice(newInvoice);
                  stepMessage = `Invoice #${newInvoice.DocNumber || newInvoice.Id} created successfully`;
                } else {
                  stepMessage = "Invoice created successfully";
                }
              } else if (toolCall.toolName === "updateInvoice") {
                const updatedInvoice =
                  toolResult.result?.QueryResponse?.Invoice?.[0] ||
                  toolResult.result;
                console.log(`🔍 updateInvoice result:`, updatedInvoice);
                if (updatedInvoice && updatedInvoice.Id) {
                  setInvoices((prev) =>
                    prev.map((inv) =>
                      inv.Id === updatedInvoice.Id ? updatedInvoice : inv,
                    ),
                  );
                  if (selectedInvoiceId === updatedInvoice.Id) {
                    setSelectedInvoice(updatedInvoice);
                  }
                  stepMessage = `Invoice #${updatedInvoice.DocNumber || updatedInvoice.Id} updated successfully`;
                } else {
                  stepMessage = "Invoice updated successfully";
                }
              } else if (toolCall.toolName === "deleteInvoice") {
                const invoiceId = toolCall.args?.invoiceId;
                console.log(`🔍 deleteInvoice for ID:`, invoiceId);
                setInvoices((prev) =>
                  prev.filter((inv) => inv.Id !== invoiceId),
                );
                if (selectedInvoiceId === invoiceId) {
                  setSelectedInvoiceId("");
                  setSelectedInvoice(null);
                }
                stepMessage = `Invoice #${invoiceId} deleted successfully`;
              } else if (toolCall.toolName === "emailInvoicePdf") {
                const invoiceId = toolCall.args?.invoiceId;
                const email = toolCall.args?.email;
                console.log(
                  `🔍 emailInvoicePdf for ID ${invoiceId} to ${email}`,
                );
                stepMessage = `Invoice #${invoiceId} emailed to ${email} successfully`;
              }
            }

            if (stepSuccess) {
              invoiceDataFound = true;
            }
            stepResults.push(stepMessage);
          }

          // For multi-step workflows, combine all step results
          if (result.isMultiStep && stepResults.length > 1) {
            responseText = `Multi-step operation completed:\n\n${stepResults.map((msg, index) => `${index + 1}. ${msg}`).join("\n\n")}`;
          } else if (stepResults.length > 0) {
            responseText = stepResults[stepResults.length - 1]; // Use the last (most relevant) result
          }

          // If we processed tool calls but none were successful, we still have a response
          if (!invoiceDataFound && hasAnyToolCalls && stepResults.length > 0) {
            responseText = stepResults[stepResults.length - 1]; // Use the error message
            invoiceDataFound = true; // Prevent fallback to JSON.stringify
          }
        }

        console.log(
          "🔍 After processing tool calls - invoiceDataFound:",
          invoiceDataFound,
        );
        console.log("🔍 Current invoices state:", invoices.length);
        console.log("🔍 Response text:", responseText);

        // If no invoice data was found in tool calls, check for direct invoice data in response
        if (!invoiceDataFound) {
          console.log(
            "🔍 No invoice data found in tool calls, checking fallback methods...",
          );
          // Try to extract invoice data from the main result
          const directInvoiceData = extractInvoiceData(result);
          console.log("🔍 Direct invoice data extracted:", directInvoiceData);

          if (directInvoiceData && directInvoiceData.length > 0) {
            invoiceDataFound = true;
            console.log(
              "🔍 Setting invoices from direct data:",
              directInvoiceData.length,
            );

            // Check if it's a single invoice or multiple invoices
            if (directInvoiceData.length === 1) {
              const invoice = directInvoiceData[0];
              setSelectedInvoiceId(invoice.Id);
              setSelectedInvoice(invoice);
              // Add to invoices list if not already there
              setInvoices((prev) => {
                const exists = prev.find((inv) => inv.Id === invoice.Id);
                return exists ? prev : [invoice, ...prev];
              });
              responseText = `Invoice #${invoice.DocNumber || invoice.Id} details loaded. Check the invoices panel to view details.`;
            } else {
              // Multiple invoices
              setInvoices(directInvoiceData);
              responseText = `Found ${directInvoiceData.length} invoice(s). Check the invoices panel to view them.`;
            }
          } else {
            console.log("🔍 No direct invoice data, checking text parsing...");
            // Check if the user's message suggests they want invoice data
            const userMessageLower = userMessage.toLowerCase();
            const invoiceKeywords = [
              "invoice",
              "invoices",
              "show",
              "list",
              "get",
              "find",
              "display",
            ];
            const containsInvoiceKeywords = invoiceKeywords.some((keyword) =>
              userMessageLower.includes(keyword),
            );

            if (containsInvoiceKeywords && result?.text) {
              // If the response text contains invoice information, try to parse it
              const parsedInvoices = parseInvoicesFromText(result.text);
              console.log("🔍 Parsed invoices from text:", parsedInvoices);

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
          console.log(
            "🔍 No invoice data found anywhere, showing original response",
          );
          // Use the AI's text response if available, otherwise provide a helpful message
          if (result?.text && result.text.trim()) {
            responseText = result.text;
          } else if (result?.toolCalls && result.toolCalls.length > 0) {
            // If tools were called but failed, provide a helpful message
            responseText =
              "The requested operation could not be completed. Please check your request and try again.";
          } else {
            responseText =
              "I'm not sure how to help with that request. Could you please rephrase or try a different command?";
          }
        }

        // Add workflow progress for multi-step operations
        if (workflowText && responseText) {
          responseText = responseText + workflowText;
        }

        console.log("🔍 Final response text:", responseText);
        await streamAIResponse(responseText);
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        await streamAIResponse(
          "Request timed out. QuickBooks operations can take up to a minute. Please try again or use a more specific query.",
        );
      } else {
        await streamAIResponse(err.message || "Sorry, something went wrong.");
      }
    } finally {
      setChatLoading(false);
    }
  };

  // Handle modal navigation
  const handleModalNavigation = (direction: "prev" | "next") => {
    if (direction === "prev" && modalCurrentIndex > 0) {
      setModalCurrentIndex(modalCurrentIndex - 1);
    } else if (
      direction === "next" &&
      modalCurrentIndex < invoices.length - 1
    ) {
      setModalCurrentIndex(modalCurrentIndex + 1);
    }
  };

  // Handle modal invoice selection
  const handleModalInvoiceSelect = (invoice: InvoiceSummary, index: number) => {
    setSelectedInvoiceId(invoice.Id);
    setModalCurrentIndex(index);
    setShowAllInvoicesModal(false);
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
              <p className={styles.invoiceDetailText}>
                Select an invoice to view details.
              </p>
            </div>
          </section>
          <section className={styles.rightPanel}>
            <h2 className={styles.panelTitle}>AI Chat</h2>
            <div className={styles.chatContainer}>
              <div className={styles.chatMessageAI}>
                Checking QuickBooks authentication...
              </div>
            </div>
            <form className={styles.chatInputForm}>
              <input
                type="text"
                className={styles.chatInput}
                value=""
                readOnly
                disabled
              />
              <button type="submit" className={styles.chatSendButton} disabled>
                Send
              </button>
            </form>
          </section>
        </div>
      </main>
    );
  }

  return (
    <AuthGuard>
      <main className={styles.mainContainer}>
        {/* Sign Out Button */}
        {user && (
          <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 1000
          }}>
            <button
              onClick={signOut}
              style={{
                background: '#e11d48',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Sign Out
            </button>
          </div>
        )}
        <div className={styles.panelsWrapper}>
        {/* Left Panel: Invoice List + Detail */}
        <section className={styles.leftPanel}>
          <div className={styles.invoiceHeaderSection}>
            <h2 className={styles.panelTitle}>Invoices</h2>
            {invoices.length > 0 && (
              <button
                className={styles.viewAllButton}
                onClick={() => setShowAllInvoicesModal(true)}
              >
                View All ({invoices.length})
              </button>
            )}
          </div>

          {/* Auth error: show connect button */}
          {authError ? (
            <div style={{ textAlign: "center" }}>
              <p style={{ color: "#e11d48", marginBottom: 16 }}>
                Not connected to QuickBooks.
              </p>
              <a
                href="/api/auth/quickbooks/login"
                className={styles.chatSendButton}
                style={{ textDecoration: "none" }}
              >
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
                  <p>
                    No invoices loaded. Ask the AI to "show invoices" or "list
                    invoices".
                  </p>
                </div>
              ) : (
                <div className={styles.invoiceSliderWrapper}>
                  <button
                    className={`${styles.sliderButton} ${styles.sliderButtonLeft}`}
                    onClick={() => scrollInvoiceSlider("left")}
                    aria-label="Previous invoices"
                  >
                    ‹
                  </button>
                  <div
                    className={styles.invoiceCardsSlider}
                    ref={invoiceSliderRef}
                  >
                    {invoices.map((inv) => (
                      <div
                        key={inv.Id}
                        className={`${styles.invoiceCard} ${inv.Id === selectedInvoiceId ? styles.invoiceCardActive : ""}`}
                        onClick={() => setSelectedInvoiceId(inv.Id)}
                      >
                        <div className={styles.invoiceCardHeader}>
                          <h4 className={styles.invoiceCardNumber}>
                            #{inv.DocNumber || inv.Id}
                          </h4>
                          <span className={styles.invoiceCardAmount}>
                            $
                            {inv.TotalAmt
                              ? Number(inv.TotalAmt).toFixed(2)
                              : "0.00"}
                          </span>
                        </div>
                        <div className={styles.invoiceCardInfo}>
                          <p className={styles.invoiceCardCustomer}>
                            {inv.CustomerRef?.name || "Unknown Customer"}
                          </p>
                          <p className={styles.invoiceCardDate}>
                            {inv.TxnDate
                              ? new Date(inv.TxnDate).toLocaleDateString()
                              : "No date"}
                          </p>
                        </div>
                        <div className={styles.invoiceCardStatus}>
                          <span
                            className={`${styles.statusBadge} ${inv.Balance && Number(inv.Balance) > 0 ? styles.statusPending : styles.statusPaid}`}
                          >
                            {inv.Balance && Number(inv.Balance) > 0
                              ? "Pending"
                              : "Paid"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    className={`${styles.sliderButton} ${styles.sliderButtonRight}`}
                    onClick={() => scrollInvoiceSlider("right")}
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
                  <strong>ID:</strong> {selectedInvoice.Id}
                  <br />
                  <strong>Number:</strong> {selectedInvoice.DocNumber}
                  <br />
                  <strong>Customer:</strong>{" "}
                  {selectedInvoice.CustomerRef?.name || "-"}
                  <br />
                  <strong>Date:</strong> {selectedInvoice.TxnDate || "-"}
                  <br />
                  <strong>Total:</strong> $
                  {selectedInvoice.TotalAmt?.toFixed(2) || "-"}
                </div>
                <div>
                  <strong>Line Items:</strong>
                  <ul style={{ margin: 0, paddingLeft: 16 }}>
                    {selectedInvoice.Line?.map((line, idx) => (
                      <li key={idx}>
                        {line.Description || line.DetailType || "Line Item"}
                      </li>
                    )) || <li>No line items</li>}
                  </ul>
                </div>
              </div>
            ) : (
              <p className={styles.invoiceDetailText}>
                {selectedInvoiceId
                  ? "Loading details..."
                  : "Select an invoice to view details."}
              </p>
            )}
          </div>
        </section>

        {/* Right Panel: AI Chat */}
        <section className={styles.rightPanel}>
          <div className={styles.chatHeader}>
            <h2 className={styles.panelTitle}>AI Chat</h2>
            {/* AI Agent Avatar */}
            <div className={styles.aiAvatar}>
              <div className={styles.avatarCircle}>
                <svg
                  className={styles.avatarIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"
                    fill="#00FFB2"
                  />
                </svg>
              </div>
            </div>
          </div>
          {authError ? (
            <div className={styles.chatContainer}>
              <div className={styles.chatMessageAI}>
                Please connect to QuickBooks to start using the AI invoice
                assistant.
              </div>
            </div>
          ) : (
            <div className={styles.chatContainer} ref={chatContainerRef}>
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={
                    msg.role === "user"
                      ? styles.chatMessageUser
                      : styles.chatMessageAI +
                        (msg.streaming ? " " + styles.chatMessageLoading : "")
                  }
                >
                  {msg.content}
                </div>
              ))}
              {chatLoading &&
                !chatMessages[chatMessages.length - 1]?.streaming && (
                  <div
                    className={
                      styles.chatMessageAI + " " + styles.chatMessageLoading
                    }
                  >
                    Thinking...
                  </div>
                )}
            </div>
          )}
          <form
            className={styles.chatInputForm}
            onSubmit={handleChatSubmit}
            autoComplete="off"
          >
            <input
              type="text"
              placeholder={
                authError
                  ? "Connect to QuickBooks first..."
                  : "Type your message..."
              }
              className={styles.chatInput}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatLoading || authError}
            />
            <button
              type="submit"
              className={styles.chatSendButton}
              disabled={chatLoading || !chatInput.trim() || authError}
            >
              Send
            </button>
          </form>
          {/* Date + Time Stamp */}
          <div className={styles.timestampContainer}>
            <span className={styles.timestamp}>
              Last sync:{" "}
              {new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}{" "}
              ·{" "}
              {new Date().toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })}
            </span>
          </div>
        </section>
      </div>

      {/* All Invoices Modal */}
      {showAllInvoicesModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                All Invoices ({invoices.length})
              </h2>
              <button
                className={styles.modalCloseButton}
                onClick={() => setShowAllInvoicesModal(false)}
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.invoiceGrid}>
                {invoices.map((invoice, index) => (
                  <div
                    key={invoice.Id}
                    className={`${styles.modalInvoiceCard} ${invoice.Id === selectedInvoiceId ? styles.modalInvoiceCardActive : ""}`}
                    onClick={() => handleModalInvoiceSelect(invoice, index)}
                  >
                    <div className={styles.modalInvoiceHeader}>
                      <h4 className={styles.modalInvoiceNumber}>
                        #{invoice.DocNumber || invoice.Id}
                      </h4>
                      <span className={styles.modalInvoiceAmount}>
                        $
                        {invoice.TotalAmt
                          ? Number(invoice.TotalAmt).toFixed(2)
                          : "0.00"}
                      </span>
                    </div>
                    <div className={styles.modalInvoiceInfo}>
                      <p className={styles.modalInvoiceCustomer}>
                        {invoice.CustomerRef?.name || "Unknown Customer"}
                      </p>
                      <p className={styles.modalInvoiceDate}>
                        {invoice.TxnDate
                          ? new Date(invoice.TxnDate).toLocaleDateString()
                          : "No date"}
                      </p>
                    </div>
                    <div className={styles.modalInvoiceStatus}>
                      <span
                        className={`${styles.statusBadge} ${invoice.Balance && Number(invoice.Balance) > 0 ? styles.statusPending : styles.statusPaid}`}
                      >
                        {invoice.Balance && Number(invoice.Balance) > 0
                          ? "Pending"
                          : "Paid"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation Controls */}
            {invoices.length > 0 && (
              <div className={styles.modalNavigation}>
                <button
                  className={`${styles.modalNavButton} ${modalCurrentIndex === 0 ? styles.modalNavButtonDisabled : ""}`}
                  onClick={() => handleModalNavigation("prev")}
                  disabled={modalCurrentIndex === 0}
                >
                  ← Previous
                </button>
                <span className={styles.modalNavInfo}>
                  {modalCurrentIndex + 1} of {invoices.length}
                </span>
                <button
                  className={`${styles.modalNavButton} ${modalCurrentIndex === invoices.length - 1 ? styles.modalNavButtonDisabled : ""}`}
                  onClick={() => handleModalNavigation("next")}
                  disabled={modalCurrentIndex === invoices.length - 1}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer Tagline */}
      <div className={styles.footerTagline}>
        <span>
          AI Invoice Assistant by Core Edge Solutions — Powered by GPT
        </span>
      </div>
    </main>
    </AuthGuard>
  );
}
