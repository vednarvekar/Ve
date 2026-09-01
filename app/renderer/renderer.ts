/**
 * Phase 1 renderer: plain TS, no React yet.
 * architecture.md specifies React for the renderer long-term — this
 * minimal version exists to prove the popup/chat/IPC loop first, per
 * phases.md Phase 1's explicit goal ("prove the interaction shell works
 * before any intelligence is added"). Swapping this for React in Phase 2
 * is a renderer-only change; it won't touch main/preload/IPC contracts.
 */

const messagesEl = document.getElementById("messages") as HTMLDivElement;
const emptyStateEl = document.getElementById("emptyState") as HTMLDivElement;
const formEl = document.getElementById("inputForm") as HTMLFormElement;
const inputEl = document.getElementById("textInput") as HTMLInputElement;

function timestamp(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function appendBubble(text: string, kind: "user" | "assistant", status?: "success" | "error"): void {
  emptyStateEl.style.display = "none";

  const bubble = document.createElement("div");
  bubble.className = `bubble ${kind}${status ? ` ${status}` : ""}`;

  const textNode = document.createElement("span");
  textNode.textContent = text;
  bubble.appendChild(textNode);

  const time = document.createElement("span");
  time.className = "timestamp";
  time.textContent = timestamp();
  bubble.appendChild(time);

  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function showProcessing(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "processing";
  el.textContent = "Working on it…";
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return el;
}

formEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = inputEl.value.trim();
  if (!text) return;

  appendBubble(text, "user");
  inputEl.value = "";
  inputEl.disabled = true;

  const processingEl = showProcessing();

  try {
    const result = await window.ve.runCommand(text);
    processingEl.remove();
    appendBubble(result.message, "assistant", result.success ? "success" : "error");
  } catch (err) {
    processingEl.remove();
    appendBubble("Something went wrong on my end.", "assistant", "error");
  } finally {
    inputEl.disabled = false;
    inputEl.focus();
  }
});

// Mic button is visibly present but disabled — voice input is Phase 4.
// Keeping it in the UI now (rather than adding it later) matches
// design.md's intended layout so the shell doesn't need reshaping later.
