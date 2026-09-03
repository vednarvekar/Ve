import React, { useEffect, useRef } from "react";
import type { ChatMessage } from "../hooks/useChat.js";
import { MessageBubble } from "./messageBubble.js";

export function ChatView({
  messages,
  isProcessing,
}: {
  messages: ChatMessage[];
  isProcessing: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isProcessing]);

  if (messages.length === 0 && !isProcessing) {
    return (
      <div className="messages">
        <div className="empty-state">Type or speak a command</div>
      </div>
    );
  }

  return (
    <div className="messages">
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      {isProcessing && <div className="processing">Working on it…</div>}
      <div ref={bottomRef} />
    </div>
  );
}
