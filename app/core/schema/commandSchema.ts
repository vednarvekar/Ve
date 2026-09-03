export type SkillName = "openApp" | "openUrl" | "webSearch";

export interface Command {
    skill: SkillName;
    params: Record<string, string>;
}

export type ParsedIntent = 
    | { type: "command"; command: Command } 
    | { type: "clarify"; question: string } 
    | { type: "unknown" };

export interface SkillResult {
    success: boolean;
    message: string;
}

