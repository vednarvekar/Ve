import { randomUUID } from "node:crypto";
import type { Command } from "../schema/commandSchema.js";
import { WordPieceTokenizer, defaultTokenizer } from "./tokenizer.js";
import { OnnxInferenceEngine, defaultInferenceEngine } from "./inferenceSession.js";
import { LoRAAdapterHead } from "./adapterHead.js";

export const INTENT_LABELS = [
  "app.launch",
  "web.search",
  "web.navigate",
  "comm.message",
  "conversational.greeting",
  "assistant.unknown",
] as const;

export type IntentName = typeof INTENT_LABELS[number];

export interface SlotValue {
  rawValue: string;
  normalizedValue: string | number | boolean;
  confidence: number;
}

export interface CommandAST {
  version: 1;
  id: string;
  sourceText: string;
  intent: IntentName;
  confidence: number;
  slots: Record<string, SlotValue>;
  fallbackApplied: boolean;
  command?: Command | undefined;
  conversationalReply?: string | undefined;
  latencyMs: number;
}

// Canonical neural anchors for semantic space classification
const INTENT_ANCHORS: Record<IntentName, string> = {
  "app.launch": "open application, launch software program, open chrome, open terminal, open vscode, open calculator, open notepad",
  "web.navigate": "visit website url, browse web domain page, open youtube.com, open netflix.com, open github.com",
  "conversational.greeting": "hello, hi, hey, greetings, good morning, good evening, how are you",
  "web.search": "search query on Google, look up information on web, find internet results",
  "comm.message": "send message, text a friend on whatsapp, chat with contact",
  "assistant.unknown": "unrecognized input or random characters",
};

export class SLMIntentParser {
  private tokenizer: WordPieceTokenizer;
  private engine: OnnxInferenceEngine;
  private adapter: LoRAAdapterHead;
  private anchorEmbeddings: Map<IntentName, Float32Array> = new Map();
  private initializedAnchors = false;

  constructor(options?: {
    tokenizer?: WordPieceTokenizer;
    engine?: OnnxInferenceEngine;
    adapter?: LoRAAdapterHead;
  }) {
    this.tokenizer = options?.tokenizer ?? defaultTokenizer;
    this.engine = options?.engine ?? defaultInferenceEngine;
    this.adapter = options?.adapter ?? new LoRAAdapterHead({ inFeatures: 384, outFeatures: 6 });
  }

  private async ensureAnchors(): Promise<void> {
    if (this.initializedAnchors) return;
    for (const [intent, text] of Object.entries(INTENT_ANCHORS)) {
      const res = await this.engine.embed(text);
      this.anchorEmbeddings.set(intent as IntentName, res.sentenceEmbedding);
    }
    this.initializedAnchors = true;
  }

  public getAdapter(): LoRAAdapterHead {
    return this.adapter;
  }

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!;
    }
    return Math.max(0, Math.min(1, dot));
  }

  public async parse(rawInput: string): Promise<CommandAST> {
    const start = performance.now();
    const clean = rawInput.trim();
    if (!clean) {
      return this.buildUnknown(rawInput, 0);
    }

    await this.ensureAnchors();

    // 1. Run real MiniLM ONNX forward pass
    const inference = await this.engine.embed(clean);
    const embedding = inference.sentenceEmbedding;

    // 2. Compute similarity against neural intent anchors
    const similarities = INTENT_LABELS.map((intent) => {
      const anchor = this.anchorEmbeddings.get(intent)!;
      return { intent, score: this.cosineSimilarity(embedding, anchor) };
    });

    // 3. Apply personal LoRA adapter weights
    const adapterDeltas = this.adapter.forward(embedding);
    const combinedScores = similarities.map((item, idx) => ({
      intent: item.intent,
      score: item.score + (adapterDeltas[idx] ?? 0),
    }));

    combinedScores.sort((a, b) => b.score - a.score);
    const top = combinedScores[0]!;

    // 4. Handle conversational greeting directly from SLM
    if (top.intent === "conversational.greeting" && top.score >= 0.28) {
      return {
        version: 1,
        id: randomUUID(),
        sourceText: rawInput,
        intent: "conversational.greeting",
        confidence: top.score,
        slots: {},
        fallbackApplied: false,
        conversationalReply: "Hey! What would you like to do on your desktop?",
        latencyMs: performance.now() - start,
      };
    }

    // 5. Extract slots and map to structured command
    const slots = this.extractSlots(clean, top.intent);
    const command = this.mapToCommand(top.intent, slots, clean);

    return {
      version: 1,
      id: randomUUID(),
      sourceText: rawInput,
      intent: top.intent,
      confidence: Math.min(1.0, top.score),
      slots,
      fallbackApplied: false,
      command,
      latencyMs: performance.now() - start,
    };
  }

  private extractSlots(text: string, intent: IntentName): Record<string, SlotValue> {
    const slots: Record<string, SlotValue> = {};
    const lower = text.toLowerCase();

    if (intent === "app.launch") {
      const match = lower.match(/(?:open|launch|start|run)\s+(?:my\s+)?([a-z0-9_\-\s]+)/i);
      const appName = match ? match[1]!.trim() : text.trim();
      slots.appIdentifier = { rawValue: appName, normalizedValue: appName, confidence: 0.95 };
    } else if (intent === "web.navigate") {
      const match = lower.match(/(?:open|go\s+to|visit)\s+(?:my\s+)?([a-z0-9_\-\s.]+)/i);
      const target = match ? match[1]!.trim() : text.trim();
      slots.url = { rawValue: target, normalizedValue: target, confidence: 0.95 };
    } else if (intent === "comm.message") {
      const match1 = lower.match(/(?:send|message|text)\s+["']?(.+?)["']?\s+to\s+([a-z0-9_\-\s]+)/i);
      const match2 = lower.match(/(?:send|message|text)\s+([a-z0-9_\-\s]+?)\s+(?:saying|that)\s+["']?(.+?)["']?[.!?]*$/i);
      if (match1) {
        slots.messageBody = { rawValue: match1[1]!.trim(), normalizedValue: match1[1]!.trim(), confidence: 0.95 };
        slots.recipient = { rawValue: match1[2]!.trim(), normalizedValue: match1[2]!.trim(), confidence: 0.95 };
      } else if (match2) {
        slots.recipient = { rawValue: match2[1]!.trim(), normalizedValue: match2[1]!.trim(), confidence: 0.95 };
        slots.messageBody = { rawValue: match2[2]!.trim(), normalizedValue: match2[2]!.trim(), confidence: 0.95 };
      }
    } else if (intent === "web.search") {
      const match = lower.match(/(?:search|look\s+up|google|find)\s+(?:for\s+)?(.+?)(?:\s+on\s+([a-z0-9]+))?$/i);
      if (match) {
        slots.query = { rawValue: match[1]!.trim(), normalizedValue: match[1]!.trim(), confidence: 0.9 };
        if (match[2]) {
          slots.provider = { rawValue: match[2].trim(), normalizedValue: match[2].trim(), confidence: 0.95 };
        }
      } else {
        slots.query = { rawValue: text, normalizedValue: text, confidence: 0.7 };
      }
    }

    return slots;
  }

  private mapToCommand(intent: IntentName, slots: Record<string, SlotValue>, rawText: string): Command {
    switch (intent) {
      case "app.launch":
        return {
          skill: "openApp",
          params: { target: String(slots.appIdentifier?.normalizedValue || rawText) },
        };
      case "web.navigate":
        return {
          skill: "browser",
          params: {
            action: "navigate",
            url: String(slots.url?.normalizedValue || rawText),
          },
        };
      case "web.search":
        return {
          skill: "browser",
          params: {
            action: "search",
            query: String(slots.query?.normalizedValue || rawText),
            provider: String(slots.provider?.normalizedValue || "google"),
          },
        };
      case "comm.message":
        return {
          skill: "whatsApp",
          params: {
            message: String(slots.messageBody?.normalizedValue || ""),
            recipientName: String(slots.recipient?.normalizedValue || ""),
          },
        };
      default:
        return {
          skill: "openApp",
          params: { target: rawText },
        };
    }
  }

  private buildUnknown(sourceText: string, latencyMs: number): CommandAST {
    return {
      version: 1,
      id: randomUUID(),
      sourceText,
      intent: "assistant.unknown",
      confidence: 0,
      slots: {},
      fallbackApplied: true,
      command: { skill: "openApp", params: { target: "" } },
      latencyMs,
    };
  }
}

export const defaultSLMParser = new SLMIntentParser();
