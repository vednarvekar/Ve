# LLD: 10–20M SLM Runtime & Inference Engine

## 1. Runtime Specifications & Budget

| Attribute | Specification |
|---|---|
| **Parameter Target** | 12M–18M parameters |
| **Model Format** | ONNX (`.onnx`) or GGUF (`.gguf`) |
| **Quantization** | INT8 (weights + activations) or INT4 (weights) |
| **Memory Resident Footprint** | $\le 45\text{MB}$ in RAM |
| **Compute Engine** | `onnxruntime-node` with CPU Execution Provider (AVX2 / ARM NEON) |
| **Inference Target** | $\le 65\text{ms}$ on 4-thread CPU for 32-token sequences |

---

## 2. Directory Layout & Model Packaging

```text
app/
  core/
    slm/
      assets/
        tokenizer.json          # BPE Vocabulary & Merges (~1.2MB)
        ve-slm-intent-int8.onnx  # Quantized Base Model (~16.8MB)
        grammar-schema.bnf      # Constrained JSON grammar
      tokenizer.ts             # JS / WASM Tokenizer wrapper
      inferenceSession.ts      # ONNX Runtime Session Lifecycle
      grammarConstraint.ts     # Logit processor / Token masking
      intentParser.ts          # High-level parse(text) API
```

---

## 3. Session Lifecycle & Memory Management

The SLM session is initialized lazily and kept warm in memory:

```typescript
import * as ort from "onnxruntime-node";
import path from "node:path";

export class SLMInferenceEngine {
  private session: ort.InferenceSession | null = null;
  private isInitializing = false;

  public async getSession(): Promise<ort.InferenceSession> {
    if (this.session) return this.session;

    if (this.isInitializing) {
      await this.waitForInit();
      return this.session!;
    }

    this.isInitializing = true;
    const modelPath = path.join(__dirname, "assets", "ve-slm-intent-int8.onnx");

    const sessionOptions: ort.InferenceSession.SessionOptions = {
      executionProviders: ["cpu"],
      graphOptimizationLevel: "all",
      intraOpNumThreads: 2, // Low thread contention with UI
      interOpNumThreads: 1,
    };

    this.session = await ort.InferenceSession.create(modelPath, sessionOptions);
    this.isInitializing = false;
    return this.session;
  }

  public async runInference(inputIds: Int32Array, attentionMask: Int32Array): Promise<ort.Tensor> {
    const session = await this.getSession();
    const feeds: Record<string, ort.Tensor> = {
      input_ids: new ort.Tensor("int32", inputIds, [1, inputIds.length]),
      attention_mask: new ort.Tensor("int32", attentionMask, [1, attentionMask.length]),
    };

    const results = await session.run(feeds);
    return results["logits"]!;
  }
}
```

---

## 4. Grammar-Constrained Token Generation

To eliminate hallucinated syntax and guarantee strictly valid JSON output, a logit processor enforces standard grammar rules:

1. **State Machine Tracking**: Maintains the current JSON syntax state (e.g. `IN_KEY`, `IN_VALUE`, `IN_ARRAY`).
2. **Token Masking**: Before sampling the next token, set the logit of any token that violates the grammar to $-\infty$.
3. **Guaranteed Schema**: The model can only produce tokens that follow the pre-approved `CommandAST` structure.

---

## 5. Benchmark & Validation Protocol

Before deploying any new version of the 10–20M model weights, the artifact must pass an automated evaluation suite:

```typescript
// scripts/eval-slm.ts
interface TestCase {
  input: string;
  expectedIntent: string;
  expectedSlots: Record<string, string>;
}

// 1. Target: >= 94% Intent Classification Accuracy across 500 test cases
// 2. Target: >= 90% Slot Extraction F1-Score
// 3. Target: 99th percentile inference latency <= 120ms
```
