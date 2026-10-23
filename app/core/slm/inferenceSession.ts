import * as ort from "onnxruntime-node";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defaultTokenizer, type TokenizedSequence } from "./tokenizer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ModelInferenceResult {
  sentenceEmbedding: Float32Array; // 384-dimensional dense semantic embedding from MiniLM
  tokens: string[];
  durationMs: number;
}

export class OnnxInferenceEngine {
  private session: ort.InferenceSession | null = null;
  private isInitializing = false;
  private modelPath: string;

  constructor(customModelPath?: string) {
    this.modelPath = customModelPath || path.join(__dirname, "assets", "model.onnx");
  }

  public async getSession(): Promise<ort.InferenceSession> {
    if (this.session) return this.session;

    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise((r) => setTimeout(r, 10));
      }
      if (this.session) return this.session;
    }

    this.isInitializing = true;
    try {
      if (!existsSync(this.modelPath)) {
        throw new Error(`ONNX model file not found at: ${this.modelPath}`);
      }

      const options: ort.InferenceSession.SessionOptions = {
        executionProviders: ["cpu"],
        graphOptimizationLevel: "all",
        intraOpNumThreads: 2,
        interOpNumThreads: 1,
      };

      this.session = await ort.InferenceSession.create(this.modelPath, options);
      return this.session;
    } finally {
      this.isInitializing = false;
    }
  }

  public async embed(text: string): Promise<ModelInferenceResult> {
    const start = performance.now();
    const tokenized: TokenizedSequence = defaultTokenizer.encode(text);
    const session = await this.getSession();

    const seqLen = tokenized.inputIds.length;
    const inputIdsTensor = new ort.Tensor("int64", tokenized.inputIds, [1, seqLen]);
    const attentionMaskTensor = new ort.Tensor("int64", tokenized.attentionMask, [1, seqLen]);
    const tokenTypeIdsTensor = new ort.Tensor("int64", tokenized.tokenTypeIds, [1, seqLen]);

    const feeds: Record<string, ort.Tensor> = {
      input_ids: inputIdsTensor,
      attention_mask: attentionMaskTensor,
      token_type_ids: tokenTypeIdsTensor,
    };

    const outputs = await session.run(feeds);
    const lastHiddenState = outputs["last_hidden_state"]!;
    const [batchSize, tokensLen, hiddenDim] = lastHiddenState.dims as [number, number, number];

    // Mean pooling with attention mask to get the 384-dim sentence embedding
    const data = lastHiddenState.data as Float32Array;
    const pooled = new Float32Array(hiddenDim);
    let validTokenCount = 0;

    for (let t = 0; t < tokensLen; t++) {
      if (tokenized.attentionMask[t] === 1n) {
        validTokenCount++;
        const offset = t * hiddenDim;
        for (let d = 0; d < hiddenDim; d++) {
          pooled[d]! += data[offset + d]!;
        }
      }
    }

    if (validTokenCount > 0) {
      for (let d = 0; d < hiddenDim; d++) {
        pooled[d]! /= validTokenCount;
      }
    }

    // L2 Normalize embedding
    let norm = 0;
    for (let d = 0; d < hiddenDim; d++) {
      norm += pooled[d]! * pooled[d]!;
    }
    norm = Math.sqrt(norm) || 1e-12;
    for (let d = 0; d < hiddenDim; d++) {
      pooled[d]! /= norm;
    }

    const durationMs = performance.now() - start;

    return {
      sentenceEmbedding: pooled,
      tokens: tokenized.tokens,
      durationMs,
    };
  }
}

export const defaultInferenceEngine = new OnnxInferenceEngine();
