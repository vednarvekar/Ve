import type { ParsedIntent } from "../schema/commandSchema.js";
import { hardcodedCommands } from "../intentParser/commandFallback.js";

export async function parsedResponse(rawInput: string): Promise<ParsedIntent> {
    const trimmed = rawInput.trim();
    if(!trimmed){
        return { type: 'unknown'}
    }

    const fallBackCommand = hardcodedCommands(trimmed);
    if(fallBackCommand) {
        return { type: "command", command: fallBackCommand }
    }

    return { type: 'unknown' };
}
