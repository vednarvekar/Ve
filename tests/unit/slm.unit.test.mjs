import assert from "node:assert/strict";
import { defaultTokenizer } from "../../dist/core/slm/tokenizer.js";
import { defaultInferenceEngine } from "../../dist/core/slm/inferenceSession.js";
import { LoRAAdapterHead } from "../../dist/core/slm/adapterHead.js";
import { defaultSLMParser } from "../../dist/core/slm/slmIntentParser.js";

console.log("=== Strict Unit Tests: SLM Brain & LoRA Adapter ===");

// 1. Tokenizer Boundary Tests
const emptyTokenized = defaultTokenizer.encode("");
assert.ok(emptyTokenized.inputIds.length > 0, "Empty input must still generate [CLS] and [SEP]");
assert.equal(emptyTokenized.inputIds[0], 101n, "First token must be [CLS]");
assert.equal(emptyTokenized.inputIds[1], 102n, "Second token must be [SEP]");

// Punctuation and emoji handling
const emojiText = "open chrome! 🚀 https://youtube.com";
const emojiTokenized = defaultTokenizer.encode(emojiText);
assert.ok(emojiTokenized.tokens.length >= 4, "Must tokenize words and emojis without crashing");
console.log("PASS tokenizer handles boundary cases, empty strings, and special characters");

// 2. Real ONNX Model Inference & Latency
// Warmup
await defaultInferenceEngine.embed("warmup");

const t0 = performance.now();
const embedResult = await defaultInferenceEngine.embed("open my visual studio code");
const elapsed = performance.now() - t0;

assert.equal(embedResult.sentenceEmbedding.length, 384, "MiniLM must output exactly 384 dimensions");

// Verify L2 normalization: sum of squares must equal ~1.0
let sumSq = 0;
for (let i = 0; i < embedResult.sentenceEmbedding.length; i++) {
  sumSq += embedResult.sentenceEmbedding[i] * embedResult.sentenceEmbedding[i];
}
assert.ok(Math.abs(sumSq - 1.0) < 0.01, `Embedding must be L2 normalized (got ${sumSq})`);
assert.ok(elapsed < 60, `Inference must execute in < 60ms (took ${elapsed.toFixed(1)}ms)`);
console.log(`PASS real ONNX inference pass (384-dim normalized, Latency: ${elapsed.toFixed(2)}ms)`);

// 3. LoRA Adapter Head Math Verification
const adapter = new LoRAAdapterHead({ inFeatures: 384, outFeatures: 6, rank: 4, alpha: 8 });
const initialDeltas = adapter.forward(embedResult.sentenceEmbedding);
assert.equal(initialDeltas.length, 6, "Must produce delta for all 6 intent classes");

// Initial deltas must be exactly zero because Matrix B is zero-initialized (standard LoRA behavior)
for (let i = 0; i < initialDeltas.length; i++) {
  assert.equal(initialDeltas[i], 0, "Zero-initialized Matrix B must produce 0 initial delta");
}

// Perform one training step on intent class 0 (app.launch)
const baseLogits = new Float32Array([0.1, 0.4, 0.2, 0.1, 0.1, 0.1]);
adapter.trainStep(embedResult.sentenceEmbedding, 0, baseLogits, 0.1);

const trainedDeltas = adapter.forward(embedResult.sentenceEmbedding);
assert.ok(trainedDeltas[0] > 0, "Target intent delta must increase after gradient update");
console.log("PASS LoRA adapter gradient descent monotonically updates target class");

// 4. LoRA Serialization & Deserialization
const serialized = adapter.exportWeights();
assert.equal(serialized.rank, 4);
assert.equal(serialized.inFeatures, 384);
assert.equal(serialized.outFeatures, 6);

const restoredAdapter = new LoRAAdapterHead();
restoredAdapter.loadWeights(serialized);
const restoredDeltas = restoredAdapter.forward(embedResult.sentenceEmbedding);
assert.deepEqual(Array.from(trainedDeltas), Array.from(restoredDeltas), "Restored weights must match exactly");
console.log("PASS LoRA weight serialization and restoration");
