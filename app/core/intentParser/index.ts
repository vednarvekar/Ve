import type { ParsedIntent } from "../schema/commandSchema.js";
import { hardcodedCommands } from "./commandFallback.js";
import { defaultSLMParser } from "../slm/slmIntentParser.js";

/**
 * Dual-Path Intent Parser:
 * 1. Fast deterministic regex/prefix matching (<1ms)
 * 2. On-Device 15M SLM inference with personal LoRA adapter (<50ms)
 */
export async function parsedResponse(rawInput: string): Promise<ParsedIntent> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { type: "unknown" };
  }

  // Path 1: High-speed deterministic fallback
  const fallBackCommand = hardcodedCommands(trimmed);
  if (fallBackCommand) {
    return { type: "command", command: fallBackCommand };
  }

  // Path 2: On-device SLM inference & personalization engine
  try {
    const slmAst = await defaultSLMParser.parse(trimmed);

    if (slmAst.confidence >= 0.5 && slmAst.command) {
      return { type: "command", command: slmAst.command };
    }

    if (slmAst.confidence >= 0.35) {
      return {
        type: "clarify",
        question: `Did you mean to run this action?`,
        options: [slmAst.command.skill],
      };
    }
  } catch {
    // If SLM inference encounters an unrecoverable fault, fallback gracefully
    return { type: "unknown" };
  }

  return { type: "unknown" };
}
