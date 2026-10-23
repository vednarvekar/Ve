export type SkillName =
  | "openApp"
  | "openUrl"
  | "webSearch"
  | "whatsApp"
  | "netflixSearch"
  | (string & {});

export interface Command {
  skill: SkillName;
  params: Record<string, unknown>;
}

export type ParsedIntent =
  | { type: "command"; command: Command }
  | { type: "clarify"; question: string; options?: string[] }
  | { type: "unknown"; message?: string };

export interface SkillResult {
  success: boolean;
  message: string;
  data?: unknown;
  behaviorAction?: string | undefined;
  command?: Command | undefined;
}
