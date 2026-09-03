import React from "react";
import { ChatView } from "./components/chatView.js";
import { InputBar } from "./components/inputBar.js";
import { useChat } from "./hooks/useChat.js";

export function App() {
  const { messages, isProcessing, sendMessage } = useChat();

  return (
    <div className="popup">
      <ChatView messages={messages} isProcessing={isProcessing} />
      <InputBar onSend={sendMessage} disabled={isProcessing} />
    </div>
  );
}
