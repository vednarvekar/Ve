import type { Command, SkillResult } from "../schema/commandSchema.js";
import { defaultSkillRouter } from "../skills/index.js";

export interface CommandResult extends SkillResult {
  command?: Command | undefined;
}

/**
 * Fast deterministic intent parser (<1ms).
 * Maps common phrase patterns into structured Command objects.
 */
export function hardcodedCommands(rawInput: string): Command | null {
  const input = rawInput.trim().toLowerCase().replace(/\s+/g, " ");

  if (input.length === 0) {
    return null;
  }

  // 1. WhatsApp Intent: "message/send/text <msg> to <contact>"
  const whatsappMatch = input.match(
    /(?:open\s+whatsapp\s+and\s+)?(?:send|message|text|whatsapp)\s+["“']?(.+)["”']?\s+to\s+(.+?)(?:\s+on\s+whatsapp)?[.!?]*$/i
  );
  if (whatsappMatch) {
    const message = (whatsappMatch[1] ?? "").trim().replace(/["“”']/g, "");
    const recipientName = (whatsappMatch[2] ?? "").trim();
    return {
      skill: "whatsApp",
      params: { message, recipientName },
    };
  }

  // 2. Provider-Specific Search: "search <query> on <provider>" (netflix, youtube, github, reddit)
  const providerSearchMatch = input.match(
    /\b(?:search|find|look\s+up|look\s+for)\s+(.+?)\s+on\s+(netflix|youtube|github|reddit|google|bing|duckduckgo)\b/i
  );
  if (providerSearchMatch) {
    const query = (providerSearchMatch[1] ?? "").trim().replace(/^of\s+/i, "");
    const provider = (providerSearchMatch[2] ?? "google").toLowerCase();
    return {
      skill: "browser",
      params: { action: "search", query, provider },
    };
  }

  // 2b. Legacy Netflix list phrasing: "list series on netflix"
  const netflixListMatch =
    input.match(/\b(?:make|create|show|give)\s+(?:me\s+)?(?:a\s+)?list\s+(.+?)\s+on\s+netflix\b/i) ??
    input.match(/\blist\s+(.+?)\s+on\s+netflix\b/i) ??
    input.match(/\b(?:list|show)\s+(?:me\s+)?(?:the\s+)?(series|shows|movies)\s+on\s+netflix\b/i);

  if (netflixListMatch) {
    const query = (netflixListMatch[1] ?? "series").trim().replace(/^of\s+/i, "");
    return {
      skill: "browser",
      params: { action: "search", query, provider: "netflix" },
    };
  }

  // 3. Open App or Web URL
  if (input.startsWith("open ")) {
    const target = input.slice("open ".length).trim();
    if (target.startsWith("https://") || target.startsWith("http://")) {
      return { skill: "browser", params: { action: "navigate", url: target } };
    }
    return { skill: "openApp", params: { target } };
  }

  // 4. Direct Web Navigation
  if (input.startsWith("go to ") || input.startsWith("visit ")) {
    const rest = input.split(" ").slice(2).join(" ").trim();
    return { skill: "browser", params: { action: "navigate", url: rest } };
  }

  // 5. General Web Search
  if (input.startsWith("search ")) {
    const query = input.slice("search ".length).trim();
    return { skill: "browser", params: { action: "search", query, provider: "google" } };
  }

  if (input.startsWith("look up ") || input.startsWith("google ")) {
    const query = input.replace(/^(look up|google) /, "").trim();
    return { skill: "browser", params: { action: "search", query, provider: "google" } };
  }

  return null;
}

/**
 * Executes a raw user command string through the deterministic parser and skill router.
 */
export async function handleCommand(rawInput: string): Promise<CommandResult> {
  const command = hardcodedCommands(rawInput);

  if (!command) {
    return {
      success: false,
      message:
        'I can do this locally without an AI: open supported apps, browse websites, search Google / YouTube / Netflix / GitHub, and prepare WhatsApp messages. Try “open Chrome”, “search lofi on YouTube”, “search comedies on Netflix”, or “send Hii to Ved”.',
    };
  }

  const result = await defaultSkillRouter.route(command.skill, command.params);

  return {
    ...result,
    command,
  };
}
