import React from "react";
import type { ChatMessage } from "../hooks/useChat.js";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const statusClass = message.status ? ` ${message.status}` : "";
  return (
    <div className={`bubble ${message.sender}${statusClass}`}>
      <span>{message.text}</span>
      <span className="timestamp">{formatTime(message.timestamp)}</span>
    </div>
  );
}