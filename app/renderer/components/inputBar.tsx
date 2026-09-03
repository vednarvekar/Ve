import React, { useState } from "react";
import { MicButton } from "./micButton.js";

export function InputBar({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSend(value);
    setValue("");
  }

  return (
    <form className="input-bar" onSubmit={handleSubmit}>
      <MicButton />
      <input
        type="text"
        className="text-input"
        placeholder="Ask Ve to do something…"
        autoComplete="off"
        autoFocus
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" className="send-button" title="Send" disabled={disabled}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
        </svg>
      </button>
    </form>
  );
}
