import { ChatView } from "./components/chatView.js";
import { InputBar } from "./components/inputBar.js";
import { useChat } from "./hooks/useChat.js";
import { useEffect, useState } from "react";

type Memory = { id: string; text: string; createdAt: number };
type Contact = { id: string; name: string; phone: string };

export function App() {
  const { messages, isProcessing, sendMessage, clearHistory, suggestions, behaviorCount, refreshSuggestions } = useChat();
  const [panel, setPanel] = useState<"offline" | "memory" | "contacts" | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [memoryText, setMemoryText] = useState("");

  useEffect(() => {
    void window.ve.listMemories().then(setMemories);
    void window.ve.listContacts().then(setContacts);
  }, []);

  async function addMemory() {
    if (!memoryText.trim()) return;
    const memory = await window.ve.addMemory(memoryText);
    setMemories((items) => [memory, ...items]);
    setMemoryText("");
  }

  async function addContact() {
    if (!contactName.trim() || !contactPhone.trim()) return;
    try {
      const contact = await window.ve.addContact(contactName, contactPhone);
      setContacts((items) => [...items, contact].sort((a, b) => a.name.localeCompare(b.name)));
      setContactName("");
      setContactPhone("");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not save contact.");
    }
  }

  async function eraseBehavior() {
    await window.ve.clearBehavior();
    await refreshSuggestions();
  }

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-ve-bg-primary">
      <header className="z-10 flex h-12 shrink-0 items-center justify-between gap-2 border-b border-ve-border-subtle bg-ve-bg-primary px-3">
        <div className="flex shrink-0 items-center gap-2"><span className="grid size-6 place-items-center rounded-lg bg-ve-accent text-xs font-bold text-white">V</span><span className="font-semibold tracking-tight">Ve</span></div>
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button onClick={() => setPanel(panel === "memory" ? null : "memory")} className="shrink-0 rounded-md px-2 py-1 text-xs text-ve-text-secondary hover:bg-ve-bg-user-bubble">Memory · {memories.length}</button>
          <button onClick={() => setPanel(panel === "contacts" ? null : "contacts")} className="shrink-0 rounded-md px-2 py-1 text-xs text-ve-text-secondary hover:bg-ve-bg-user-bubble">Contacts · {contacts.length}</button>
          <button onClick={() => setPanel(panel === "offline" ? null : "offline")} className="shrink-0 rounded-md px-2 py-1 text-xs text-ve-text-secondary hover:bg-ve-bg-user-bubble">Offline</button>
          {messages.length > 0 && <button type="button" onClick={clearHistory} className="shrink-0 rounded-md px-2 py-1 text-xs text-ve-text-secondary hover:bg-ve-bg-user-bubble hover:text-ve-text-primary">Clear</button>}
        </div>
      </header>
      <ChatView messages={messages} isProcessing={isProcessing} />
      {messages.length === 0 && suggestions.length === 0 && <div className="absolute inset-x-4 bottom-[4.5rem] z-[1] flex flex-wrap gap-2"><span className="w-full text-[11px] text-ve-text-secondary">Try a command</span>{["Open Chrome", "Search for today's weather", "Go to github.com"].map((action) => <button key={action} onClick={() => void sendMessage(action)} className="rounded-full border border-ve-border-subtle bg-ve-bg-elevated px-3 py-1.5 text-xs text-ve-text-primary hover:border-ve-accent">{action}</button>)}</div>}
      {suggestions.length > 0 && <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-t border-ve-border-subtle bg-ve-bg-primary px-3 py-2">
        <span className="shrink-0 text-[10px] text-ve-text-secondary">Suggested</span>
        {suggestions.map((suggestion) => <button key={suggestion} onClick={() => void sendMessage(suggestion)} className="shrink-0 rounded-full border border-ve-border-subtle bg-ve-bg-elevated px-3 py-1.5 text-xs text-ve-text-primary hover:border-ve-accent">{suggestion}</button>)}
      </div>}
      {panel && <div className="absolute inset-x-3 top-14 z-40 max-h-[70%] overflow-y-auto rounded-xl border border-ve-border-subtle bg-ve-bg-primary p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{panel === "offline" ? "Offline assistant" : panel === "contacts" ? "WhatsApp contacts" : "Saved memory"}</h2><button onClick={() => setPanel(null)} className="text-ve-text-secondary">Close</button></div>
        {panel === "offline" ? <div className="flex flex-col gap-3 text-xs text-ve-text-secondary">
          <p>Chat transcripts are temporary and are not saved. Contacts and notes you explicitly add stay on this device.</p>
          <p>Local learning has {behaviorCount} behavior samples. It stores only action categories and coarse time/day context—not message text, search terms, URLs, WhatsApp recipients, or message bodies.</p>
          <p>The on-device predictor is active. The FedAvg aggregation code is a prototype only: no server or cross-device sharing is configured, so no behavior or model data is uploaded.</p>
          <button onClick={() => void eraseBehavior()} disabled={behaviorCount === 0} className="self-start rounded-md border border-ve-border-subtle px-3 py-2 text-ve-text-primary enabled:hover:border-ve-error disabled:opacity-50">Erase learned behavior</button>
          <p>For WhatsApp, Ve prepares the chat and message but never presses Send for you.</p>
        </div> : panel === "contacts" ? <div className="flex flex-col gap-3">
          <p className="text-xs text-ve-text-secondary">Save a name and phone number with country code. Example: Ved · 14155550123. Ve opens WhatsApp with the message prefilled; you review and send it.</p>
          <input value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Contact name" className="rounded-md border border-ve-border-subtle bg-ve-bg-elevated px-3 py-2 text-sm" />
          <input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="Phone with country code" className="rounded-md border border-ve-border-subtle bg-ve-bg-elevated px-3 py-2 text-sm" />
          <button onClick={() => void addContact()} className="self-start rounded-md bg-ve-accent px-3 py-2 text-xs text-white">Save contact</button>
          {contacts.map((contact) => <div key={contact.id} className="flex items-center justify-between rounded-md bg-ve-bg-elevated p-2 text-sm"><span>{contact.name} <span className="text-xs text-ve-text-secondary">+{contact.phone}</span></span><button onClick={() => { void window.ve.deleteContact(contact.id); setContacts((items) => items.filter((item) => item.id !== contact.id)); }} className="text-xs text-ve-error">Delete</button></div>)}
          {contacts.length === 0 && <p className="text-xs text-ve-text-secondary">No contacts saved.</p>}
        </div> : <div className="flex flex-col gap-3">
          <p className="text-xs text-ve-text-secondary">Add facts or preferences Ve should use when relevant. You can inspect and delete them any time.</p>
          <textarea value={memoryText} onChange={(event) => setMemoryText(event.target.value)} placeholder="For example: I prefer concise answers." className="min-h-20 resize-y rounded-md border border-ve-border-subtle bg-ve-bg-elevated p-2 text-sm" />
          <button onClick={() => void addMemory()} className="self-start rounded-md bg-ve-accent px-3 py-2 text-xs text-white">Save memory</button>
          {memories.map((memory) => <div key={memory.id} className="flex items-start justify-between gap-3 rounded-md bg-ve-bg-elevated p-2 text-sm"><span className="whitespace-pre-wrap">{memory.text}</span><button onClick={() => { void window.ve.deleteMemory(memory.id); setMemories((items) => items.filter((item) => item.id !== memory.id)); }} className="shrink-0 text-xs text-ve-error">Delete</button></div>)}
          {memories.length === 0 && <p className="text-xs text-ve-text-secondary">No saved memories yet.</p>}
        </div>}
      </div>}
      <InputBar onSend={sendMessage} disabled={isProcessing} />
    </div>
  );
}
