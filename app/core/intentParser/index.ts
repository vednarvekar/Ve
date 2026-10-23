import type { ParsedIntent, SkillResult } from "../schema/commandSchema.js";
import { hardcodedCommands } from "./commandFallback.js";
import { defaultSLMParser } from "../slm/slmIntentParser.js";
import { defaultSkillRouter } from "../skills/index.js";

/**
 * On-Device MiniLM SLM Intent Parser:
 * Evaluates semantic vectors directly against intent anchors with personal LoRA adapter (<20ms)
 */
export async function parsedResponse(rawInput: string): Promise<ParsedIntent> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { type: "unknown" };
  }

  try {
    const slmAst = await defaultSLMParser.parse(trimmed);

    if (slmAst.command && slmAst.confidence >= 0.35) {
      return { type: "command", command: slmAst.command };
    }

    if (slmAst.confidence >= 0.25 && slmAst.command) {
      return {
        type: "clarify",
        question: `Did you mean to run this action?`,
        options: [slmAst.command.skill],
      };
    }
  } catch (err) {
    console.warn("SLM inference error:", err);
  }

  // Fast deterministic fallback if SLM is below confidence threshold
  const fallback = hardcodedCommands(trimmed);
  if (fallback) {
    return { type: "command", command: fallback };
  }

  return { type: "unknown" };
}

/**
 * End-to-end execution pipeline called by Electron IPC:
 * Evaluated by the on-device SLM model first.
 */
export async function executeUserInput(rawInput: string): Promise<SkillResult> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { success: false, message: "Type or speak a command." };
  }

  try {
    // 1. Run on-device SLM inference
    const slmAst = await defaultSLMParser.parse(trimmed);

    // If SLM detects a conversational greeting
    if (slmAst.conversationalReply) {
      return {
        success: true,
        message: slmAst.conversationalReply,
      };
    }

    // If SLM detects a desktop skill command
    if (slmAst.command && slmAst.confidence >= 0.35) {
      const result = await defaultSkillRouter.route(slmAst.command.skill, slmAst.command.params);
      return {
        ...result,
        command: slmAst.command,
      };
    }
  } catch (err) {
    console.warn("SLM execution error:", err);
  }

  // 2. High-speed rule fallback if SLM confidence is low
  const fallback = hardcodedCommands(trimmed);
  if (fallback) {
    const result = await defaultSkillRouter.route(fallback.skill, fallback.params);
    return {
      ...result,
      command: fallback,
    };
  }

  return {
    success: false,
    message: "I didn’t catch that. You can ask me to open any app or website, search the web, or text someone.",
  };
}
