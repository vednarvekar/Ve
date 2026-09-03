import type { ChatMessage } from "../hooks/useChat.js";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const alignmentClass = message.sender === "user" ? "self-end bg-ve-bg-user-bubble" : "self-start bg-ve-bg-elevated";
  const statusClass = message.status === "success"
    ? "border-l-[3px] border-ve-success"
    : message.status === "error"
      ? "border-l-[3px] border-ve-error"
      : "";

  return (
    <div className={`max-w-[85%] animate-fade-in whitespace-pre-wrap break-words rounded-xl px-3 py-2 leading-[1.4] text-ve-text-primary ${alignmentClass} ${statusClass}`}>
      <span>{message.text}</span>
      <span className="mt-1 block text-[15px] text-ve-text-secondary">{formatTime(message.timestamp)}</span>
    </div>
  );
}
