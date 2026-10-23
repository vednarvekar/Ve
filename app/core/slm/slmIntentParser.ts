/**
 * High-Level On-Device SLM Intent Parser & Personalization Brain
 *
 * Coordinates tokenization, compact INT8 transformer inference, LoRA adaptation,
 * and slot extraction to produce structured Command ASTs matching Ve skills.
 */

import { randomUUID } from "node:crypto";
import type { Command, SkillName } from "../schema/commandSchema.js";
import { FastTokenizer, defaultTokenizer } from "./tokenizer.js";
import {
  type IntentName,
  type SLMConfig,
  INTENT_LABELS,
  createDefaultModelWeights,
} from "./modelWeights.js";
import { SLMInferenceSession } from "./inferenceSession.js";
import { LoRAAdapterHead } from "./adapterHead.js";

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
  command: Command;
  latencyMs: number;
}

export class SLMIntentParser {
  private tokenizer: FastTokenizer;
  private session: SLMInferenceSession;
  private adapter: LoRAAdapterHead;

  constructor(options?: {
    tokenizer?: FastTokenizer;
    session?: SLMInferenceSession;
    adapter?: LoRAAdapterHead;
    config?: Partial<SLMConfig>;
  }) {
    this.tokenizer = options?.tokenizer ?? defaultTokenizer;
    this.session = options?.session ?? new SLMInferenceSession(createDefaultModelWeights());
    this.adapter = options?.adapter ?? new LoRAAdapterHead();
  }

  public getAdapter(): LoRAAdapterHead {
    return this.adapter;
  }

  public getSession(): SLMInferenceSession {
    return this.session;
  }

  public getTokenizer(): FastTokenizer {
    return this.tokenizer;
  }

  /**
   * Parses a natural language user query using on-device SLM inference.
   */
  public async parse(inputText: string): Promise<CommandAST> {
    const rawInput = inputText.trim();
    if (!rawInput) {
      return this.buildUnknownAST(rawInput, 0.0, 0);
    }

    // 1. Tokenization & Attention Mask Creation
    const encoded = this.tokenizer.encode(rawInput, { maxSeqLen: 32, addSpecialTokens: true });

    // 2. Transformer Forward Pass
    const inferenceOut = this.session.run(encoded.inputIds, encoded.attentionMask);

    // 3. Apply On-Device LoRA Personalization Adapter
    const adaptedLogits = this.adapter.adapt(
      inferenceOut.intentLogits,
      inferenceOut.pooledRepresentation
    );

    // 4. Softmax Intent Probabilities
    const probabilities = SLMInferenceSession.softmax(adaptedLogits);
    const winIndex = SLMInferenceSession.argMax(probabilities);
    const winIntent = INTENT_LABELS[winIndex] ?? "unknown";
    const confidence = probabilities[winIndex] ?? 0.0;

    // 5. Extract slots and map to structured Command
    const { slots, command } = this.extractSlotsAndCommand(rawInput, winIntent, confidence);

    return {
      version: 1,
      id: randomUUID(),
      sourceText: rawInput,
      intent: winIntent,
      confidence,
      slots,
      fallbackApplied: false,
      command,
      latencyMs: inferenceOut.latencyMs,
    };
  }

  /**
   * Trains the on-device LoRA adapter with a personalized phrasing example.
   * This immediately adapts model predictions for custom user shorthand.
   */
  public trainPersonalPhrase(
    phrase: string,
    targetIntent: IntentName,
    learningRate = 0.08,
    steps = 4
  ): { initialLoss: number; finalLoss: number; initialProb: number; finalProb: number } {
    const targetIdx = INTENT_LABELS.indexOf(targetIntent);
    if (targetIdx === -1) {
      throw new Error(`Unknown target intent: ${targetIntent}`);
    }

    const encoded = this.tokenizer.encode(phrase, { maxSeqLen: 32, addSpecialTokens: true });
    const out = this.session.run(encoded.inputIds, encoded.attentionMask);

    let initialLoss = 0.0;
    let initialProb = 0.0;
    let finalLoss = 0.0;
    let finalProb = 0.0;

    for (let step = 0; step < steps; step++) {
      const trainRes = this.adapter.trainStep(
        out.pooledRepresentation,
        targetIdx,
        out.intentLogits,
        learningRate
      );

      if (step === 0) {
        initialLoss = trainRes.loss;
        initialProb = trainRes.targetProb;
      }
      finalLoss = trainRes.loss;
      finalProb = trainRes.targetProb;
    }

    return {
      initialLoss,
      finalLoss,
      initialProb,
      finalProb,
    };
  }

  /**
   * Extracts parameter slots and builds the appropriate skill command.
   */
  private extractSlotsAndCommand(
    rawText: string,
    intent: IntentName,
    confidence: number
  ): { slots: Record<string, SlotValue>; command: Command } {
    const text = rawText.trim();
    const slots: Record<string, SlotValue> = {};

    switch (intent) {
      case "app.launch": {
        // Extract application target name
        let target = text
          .replace(/^(?:please\s+)?(?:launch|open|start|run)\s+(?:my\s+)?(?:the\s+)?(?:app\s+)?/i, "")
          .replace(/\s+(?:app|application)$/i, "")
          .trim();

        if (!target) {
          target = text;
        }

        slots.appIdentifier = {
          rawValue: target,
          normalizedValue: target.toLowerCase(),
          confidence,
        };

        return {
          slots,
          command: {
            skill: "openApp",
            params: { target },
          },
        };
      }

      case "web.search": {
        // Check for specific provider: "on <provider>"
        let query = text;
        let provider = "google";

        const providerMatch = query.match(
          /\s+on\s+(google|youtube|netflix|github|reddit|bing|duckduckgo)\b/i
        );

        if (providerMatch && providerMatch[1]) {
          provider = providerMatch[1].toLowerCase();
          query = query.replace(/\s+on\s+(google|youtube|netflix|github|reddit|bing|duckduckgo)\b/i, "");
        }

        // Strip search prefix verbs
        query = query
          .replace(/^(?:please\s+)?(?:look\s+up|search\s+for|search|find|google)\s+/i, "")
          .trim();

        slots.query = {
          rawValue: query,
          normalizedValue: query,
          confidence,
        };
        slots.provider = {
          rawValue: provider,
          normalizedValue: provider,
          confidence: 0.99,
        };

        return {
          slots,
          command: {
            skill: "browser",
            params: {
              action: "search",
              query,
              provider,
            },
          },
        };
      }

      case "web.navigate": {
        let url = text.replace(/^(?:please\s+)?(?:go\s+to|visit|browse\s+to|open)\s+/i, "").trim();
        if (!/^https?:\/\//i.test(url) && !url.includes(".")) {
          url = `https://www.${url}.com`;
        } else if (!/^https?:\/\//i.test(url)) {
          url = `https://${url}`;
        }

        slots.url = {
          rawValue: url,
          normalizedValue: url,
          confidence,
        };

        return {
          slots,
          command: {
            skill: "browser",
            params: {
              action: "navigate",
              url,
            },
          },
        };
      }

      case "comm.message": {
        let recipientName = "";
        let message = "";

        // Pattern 1: "message/send/text <recipient> saying <message>"
        const sayingMatch = text.match(
          /(?:send|message|text|whatsapp)\s+([^:]+?)\s+(?:saying|that)\s+(.+)$/i
        );
        if (sayingMatch && sayingMatch[1] && sayingMatch[2]) {
          recipientName = sayingMatch[1].trim().replace(/^(?:to|my)\s+/i, "");
          message = sayingMatch[2].trim().replace(/^["']|["']$/g, "");
        } else {
          // Pattern 2: "message/send/text <message> to <recipient>"
          const toMatch = text.match(
            /(?:send|message|text|whatsapp)\s+(.+?)\s+to\s+([^:]+?)$/i
          );
          if (toMatch && toMatch[1] && toMatch[2]) {
            message = toMatch[1].trim().replace(/^["']|["']$/g, "");
            recipientName = toMatch[2].trim();
          } else {
            // Pattern 3: "message/text <recipient>: <message>"
            const colonMatch = text.match(
              /(?:send|message|text|whatsapp)\s+([^:]+?):\s*(.+)$/i
            );
            if (colonMatch && colonMatch[1] && colonMatch[2]) {
              recipientName = colonMatch[1].trim();
              message = colonMatch[2].trim().replace(/^["']|["']$/g, "");
            } else {
              // Fallback
              const tokens = text.split(" ");
              recipientName = tokens[1] ?? "contact";
              message = tokens.slice(2).join(" ") || "hello";
            }
          }
        }

        slots.recipient = {
          rawValue: recipientName,
          normalizedValue: recipientName.toLowerCase(),
          confidence,
        };
        slots.message = {
          rawValue: message,
          normalizedValue: message,
          confidence,
        };

        return {
          slots,
          command: {
            skill: "whatsApp",
            params: {
              recipientName,
              message,
            },
          },
        };
      }

      default: {
        return {
          slots,
          command: {
            skill: "browser",
            params: {
              action: "search",
              query: text,
              provider: "google",
            },
          },
        };
      }
    }
  }

  private buildUnknownAST(sourceText: string, confidence: number, latencyMs: number): CommandAST {
    return {
      version: 1,
      id: randomUUID(),
      sourceText,
      intent: "unknown",
      confidence,
      slots: {},
      fallbackApplied: false,
      command: {
        skill: "browser",
        params: { action: "search", query: sourceText, provider: "google" },
      },
      latencyMs,
    };
  }
}

export const defaultSLMIntentParser = new SLMIntentParser();
