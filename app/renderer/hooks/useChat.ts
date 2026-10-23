import { useCallback, useEffect, useState } from "react";

export interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "assistant";
  status?: "success" | "error";
  timestamp: number;
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `msg-${idCounter}`;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try { localStorage.removeItem("ve:messages"); } catch { /* storage may be disabled */ }
    return [];
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [behaviorCount, setBehaviorCount] = useState(0);

  const refreshSuggestions = useCallback(async () => {
    try {
      const state = await window.ve.getPredictionState();
      setSuggestions(state.suggestions);
      setBehaviorCount(state.sampleCount);
    } catch {
      setSuggestions([]);
      setBehaviorCount(0);
    }
  }, []);

  useEffect(() => { void refreshSuggestions(); }, [refreshSuggestions]);

  const clearHistory = useCallback(() => {
    setMessages([]);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((prev) => {
      const next: ChatMessage[] = [
      ...prev,
      { id: nextId(), text: trimmed, sender: "user", timestamp: Date.now() },
      ];
      return next;
    });
    setIsProcessing(true);

    try {
      const result = await window.ve.runCommand(trimmed);
      setMessages((prev) => {
        const next: ChatMessage[] = [
        ...prev,
        {
          id: nextId(),
          text: result.message,
          sender: "assistant",
          status: result.success ? "success" : "error",
          timestamp: Date.now(),
        },
        ];
        return next;
      });
      await refreshSuggestions();
    } catch {
      setMessages((prev) => {
        const next: ChatMessage[] = [
        ...prev,
        {
          id: nextId(),
          text: "Something went wrong on my end.",
          sender: "assistant",
          status: "error",
          timestamp: Date.now(),
        },
        ];
        return next;
      });
    } finally {
      setIsProcessing(false);
    }
  }, [refreshSuggestions]);

  return { messages, isProcessing, sendMessage, clearHistory, suggestions, behaviorCount, refreshSuggestions };
}
