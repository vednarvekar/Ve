export function MicButton() {
  return (
    <button
      type="button"
      className="flex size-8 shrink-0 cursor-not-allowed items-center justify-center rounded-md bg-ve-bg-primary/80 text-ve-text-primary opacity-80 ring-1 ring-inset ring-ve-border-subtle"
      title="Voice input (coming in Phase 4)"
      disabled
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    </button>
  );
}
