import assert from "node:assert/strict";
import { defaultTokenizer } from "../dist/core/slm/tokenizer.js";
import { defaultInferenceEngine } from "../dist/core/slm/inferenceSession.js";
import { LoRAAdapterHead } from "../dist/core/slm/adapterHead.js";
import { defaultSLMParser } from "../dist/core/slm/slmIntentParser.js";

console.log("Running Real MiniLM ONNX SLM Subsystem tests...");

// 1. Tokenizer test with official WordPiece vocab
const tokenized = defaultTokenizer.encode("launch visual studio code");
assert.ok(tokenized.inputIds.length > 0, "Tokenizer must generate input IDs");
assert.equal(tokenized.inputIds[0], 101n, "First token must be [CLS] (101)");
assert.ok(tokenized.tokens.includes("[CLS]"), "Must include [CLS]");
assert.ok(tokenized.tokens.includes("[SEP]"), "Must include [SEP]");
console.log("PASS official WordPiece tokenization");

// 2. Real ONNX Model Inference Latency & Embedding test
// Initial warmup call
await defaultInferenceEngine.embed("warmup");
const embedResult = await defaultInferenceEngine.embed("search for machine learning tutorials on google");
assert.equal(embedResult.sentenceEmbedding.length, 384, "MiniLM must output a 384-dimensional embedding");
assert.ok(embedResult.durationMs < 100, `Inference latency (${embedResult.durationMs.toFixed(1)}ms) should be fast`);
console.log(`PASS real ONNX inference pass (Latency: ${embedResult.durationMs.toFixed(2)}ms)`);

// 3. LoRA Adapter Head test (r=4, inFeatures=384)
const adapter = new LoRAAdapterHead({ inFeatures: 384, outFeatures: 5 });
const deltasBefore = adapter.forward(embedResult.sentenceEmbedding);
assert.equal(deltasBefore.length, 5, "LoRA adapter output dimension must match numIntents");

// Train 1 step on target class 1 (web.search)
const dummyBaseLogits = new Float32Array([0.2, 0.5, 0.1, 0.1, 0.1]);
adapter.trainStep(embedResult.sentenceEmbedding, 1, dummyBaseLogits, 0.1);
const deltasAfter = adapter.forward(embedResult.sentenceEmbedding);
assert.notDeepEqual(deltasBefore, deltasAfter, "LoRA adapter weights should adapt after gradient step");
console.log("PASS on-device LoRA adapter gradient step");

// 4. Intent parsing with real ONNX model
const parsedApp = await defaultSLMParser.parse("launch visual studio code");
assert.equal(parsedApp.command.skill, "openApp", "Intent parser should identify openApp skill");

const parsedSearch = await defaultSLMParser.parse("search for weather tomorrow on google");
assert.equal(parsedSearch.command.skill, "browser", "Intent parser should identify browser skill");
assert.equal((parsedSearch.command.params).action, "search");

console.log("PASS real ONNX SLM intent parser correctly extracts intents and slots");
