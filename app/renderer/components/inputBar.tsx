import { useState } from "react";
import { MicButton } from "./micButton.js";

export function InputBar({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");
  const canSend = Boolean(value.trim()) && !disabled;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
  }

  return (
    <form
      className="fixed inset-x-0 bottom-0 z-50 flex min-h-14 items-center gap-2 border-t border-ve-border-subtle bg-ve-bg-elevated px-3 py-2.5 backdrop-blur-sm"
      onSubmit={handleSubmit}
    >
      <MicButton />
      <input
        type="text"
        className="min-w-0 flex-1 rounded-md border border-ve-accent bg-ve-bg-primary px-3 py-1 text-[17px] font-mono font-medium text-ve-text-primary outline-none placeholder:italic placeholder:text-ve-text-secondary focus:border-ve-accent focus:ring-1 focus:ring-ve-accent disabled:opacity-60"
        placeholder="Ask Ve to do something…"
        autoComplete="on"
        autoFocus
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
      />
      <button
        type="submit"
        className="inline-flex h-8 shrink-0 items-center justify-center rounded-md bg-ve-accent px-3 text-[13px] font-semibold text-white enabled:hover:bg-[#7ba3f2] disabled:cursor-not-allowed disabled:opacity-45"
        disabled={!canSend}
      >
        Send
      </button>
    </form>
  );
}
