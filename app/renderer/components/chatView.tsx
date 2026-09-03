import { useEffect, useRef } from "react";
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
  const empty = messages.length === 0 && !isProcessing;

  useEffect(() => {
    if (!empty) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isProcessing, empty]);

  return (
    <div className="h-full overflow-y-auto p-3 pb-16">
      {empty ? (
        // The empty state is intentionally hidden. The composer is the first
        // visible control when the popup opens.
        null
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {isProcessing && (
              <div className="self-start px-3 py-1 text-[15px] italic text-ve-text-secondary">
                Working on it…
              </div>
            )}
          </div>
          <div ref={bottomRef} />
        </>
      )}
    </div>
  );
}
