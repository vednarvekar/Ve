import { useCallback, useState } from "react";

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((prev) => [
      ...prev,
      { id: nextId(), text: trimmed, sender: "user", timestamp: Date.now() },
    ]);
    setIsProcessing(true);

    try {
      const result = await window.ve.runCommand(trimmed);
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          text: result.message,
          sender: "assistant",
          status: result.success ? "success" : "error",
          timestamp: Date.now(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          text: "Something went wrong on my end.",
          sender: "assistant",
          status: "error",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return { messages, isProcessing, sendMessage };
}