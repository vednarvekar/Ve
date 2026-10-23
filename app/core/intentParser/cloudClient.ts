export interface RawParsedIntent {
  type: "command" | "clarify" | "unknown";
  skill?: "openApp" | "openUrl" | "webSearch";
  params?: Record<string, string>;
  question?: string;
}

/** Kept as a compatibility stub: remote AI is intentionally disabled in Ve. */
export async function cloudCall(_input: string): Promise<RawParsedIntent | null> {
  return null;
}
