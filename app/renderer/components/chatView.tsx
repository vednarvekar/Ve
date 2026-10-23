import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../hooks/useChat.js";
import { MessageBubble } from "./messageBubble.js";

export function ChatView({
  messages,
  isProcessing,
}: {
  messages: ChatMessage[];
  isProcessing: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const [showLatest, setShowLatest] = useState(false);
  const empty = messages.length === 0 && !isProcessing;

  useEffect(() => {
    const element = scrollRef.current;
    if (!empty && element && (stickToBottom.current || isProcessing || messages.at(-1)?.sender === "user")) {
      element.scrollTop = element.scrollHeight;
      stickToBottom.current = true;
      setShowLatest(false);
    }
  }, [messages, isProcessing, empty]);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 48;
          stickToBottom.current = atBottom;
          setShowLatest(!atBottom);
        }}
        className="h-full overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4"
      >
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
        </>
      )}
      </div>
      {showLatest && <button
        type="button"
        onClick={() => {
          const element = scrollRef.current;
          if (element) element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
          stickToBottom.current = true;
          setShowLatest(false);
        }}
        className="absolute bottom-3 right-4 rounded-full border border-ve-border-subtle bg-ve-bg-elevated px-3 py-1.5 text-xs text-ve-text-primary shadow-lg hover:border-ve-accent"
      >↓ Latest</button>}
    </div>
  );
}
