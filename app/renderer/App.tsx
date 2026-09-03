import { ChatView } from "./components/chatView.js";
import { InputBar } from "./components/inputBar.js";
import { useChat } from "./hooks/useChat.js";

export function App() {
  const { messages, isProcessing, sendMessage } = useChat();

  return (
    <div className="relative size-full overflow-hidden bg-ve-bg-primary">
      <ChatView messages={messages} isProcessing={isProcessing} />
      <InputBar onSend={sendMessage} disabled={isProcessing} />
    </div>
  );
}
