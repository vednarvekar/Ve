import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

export interface RawParsedIntent {
  type: "command" | "clarify" | "unknown";
  skill?: "openApp" | "openUrl" | "webSearch";
  params?: Record<string, string>;
  question?: string;
}

const SYSTEM_PROMPT = `
You are the intent parser for Ve, a desktop assistant. Convert the user's request into exactly one JSON object and output nothing else — no markdown fences, no explanation, no extra text.

Available skills:
- "openApp": params = { "target": string } — opens a known desktop application (e.g. chrome, notepad, calculator, explorer, vscode)
- "openUrl": params = { "url": string } — opens a URL directly (must start with http:// or https://)
- "webSearch": params = { "query": string } — runs a web search for the given query

Respond with exactly one of these three JSON shapes:
1. {"type":"command","skill":"openApp"|"openUrl"|"webSearch","params":{...}}
2. {"type":"clarify","question":"<a short clarifying question>"} — use this whenever you cannot confidently tell which skill or what target/url/query is meant. Never guess.
3. {"type":"unknown"} — use this only if the request clearly isn't something any of the three skills could do.

Never invent a fourth skill or extra fields.
`;

const openai = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

export async function parseIntent(
  input: string
): Promise<RawParsedIntent | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "deepseek-ai/deepseek-v4-pro-0813",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: input,
        },
      ],
      temperature: 0,
      max_tokens: 300,
    });

    const output = response.choices[0]?.message?.content;

    if (!output) {
      console.error("Ve: cloud intent parser returned no output");
      return null;
    }

    const cleaned = output
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    return JSON.parse(cleaned) as RawParsedIntent;
  } catch (err) {
    console.error("Ve: cloud intent parser failed", err);
    return null;
  }
}