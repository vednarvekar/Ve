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
        <div className="flex h-full max-w-full flex-col items-center justify-center gap-1">
          <div className="max-w-full overflow-x-auto px-3 py-1 text-center font-mono text-[9px] leading-[0.95] tracking-[-0.08em] text-ve-text-primary">
            <pre className="inline-block whitespace-pre text-left">
{`██╗    ██╗███████╗██╗      ██████╗ ██████╗ ███╗   ███╗███████╗    ████████╗ ██████╗     ██╗   ██╗███████╗
██║    ██║██╔════╝██║     ██╔════╝██╔═══██╗████╗ ████║██╔════╝    ╚══██╔══╝██╔═══██╗    ██║   ██║██╔════╝
██║ █╗ ██║█████╗  ██║     ██║     ██║   ██║██╔████╔██║█████╗         ██║   ██║   ██║    ██║   ██║█████╗
██║███╗██║██╔══╝  ██║     ██║     ██║   ██║██║╚██╔╝██║██╔══╝         ██║   ██║   ██║    ╚██╗ ██╔╝██╔══╝
╚███╔███╔╝███████╗███████╗╚██████╗╚██████╔╝██║ ╚═╝ ██║███████╗       ██║   ╚██████╔╝     ╚████╔╝ ███████╗
 ╚══╝╚══╝ ╚══════╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝       ╚═╝    ╚═════╝       ╚═══╝  ╚══════╝`}
            </pre>
          </div>
          <div className="self-start px-3 py-1 text-[15px] italic text-ve-text-secondary">
            Say or type something to get started.
          </div>
        </div>
      ) : (
        <>
          <div className="flex w-full flex-col items-start gap-2">
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
