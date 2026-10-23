import assert from "node:assert/strict";
import {
  FastTokenizer,
  defaultTokenizer,
  calculateParameterCount,
  SLMInferenceSession,
  createDefaultModelWeights,
  LoRAAdapterHead,
  SLMIntentParser,
  defaultSLMIntentParser,
} from "../dist/core/slm/index.js";
import { parsedResponse } from "../dist/core/intentParser/index.js";

console.log("Running SLM Brain Subsystem tests...\n");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    throw err;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 1. Tokenizer Tests
// ---------------------------------------------------------------------------
test("Tokenizer normalizes text and produces input IDs and attention masks", () => {
  const tokenizer = new FastTokenizer();
  const raw = "  Launch My   Visual Studio Code!  ";

  // Normalization
  const normalized = tokenizer.normalize(raw);
  assert.equal(normalized, "launch my visual studio code!");

  // Tokenization
  const tokens = tokenizer.tokenize(raw);
  assert.ok(tokens.length >= 5);
  assert.ok(tokens.includes("launch"));
  assert.ok(tokens.includes("visual"));
  assert.ok(tokens.includes("studio"));
  assert.ok(tokens.includes("code"));

  // Encoding with fixed sequence length
  const encoded = tokenizer.encode(raw, { maxSeqLen: 16, addSpecialTokens: true });
  assert.equal(encoded.inputIds.length, 16);
  assert.equal(encoded.attentionMask.length, 16);

  // BOS token at index 0
  assert.equal(encoded.inputIds[0], 2, "BOS token id is 2");
  assert.equal(encoded.attentionMask[0], 1, "BOS token must be masked with 1");

  // Padding tokens at end
  const activeCount = encoded.tokens.length;
  for (let i = 0; i < activeCount; i++) {
    assert.equal(encoded.attentionMask[i], 1, `Token at index ${i} must have attentionMask 1`);
  }
  for (let i = activeCount; i < 16; i++) {
    assert.equal(encoded.inputIds[i], 0, `Padding at index ${i} must have PAD_ID 0`);
    assert.equal(encoded.attentionMask[i], 0, `Padding at index ${i} must have attentionMask 0`);
  }

  // Decoding
  const decoded = tokenizer.decode(encoded.inputIds);
  assert.ok(decoded.includes("launch"));
  assert.ok(decoded.includes("code"));
});

test("Tokenizer handles subwords and out-of-vocabulary characters", () => {
  const tokenizer = new FastTokenizer();
  const encoded = tokenizer.encode("supercalifragilistic", { maxSeqLen: 32 });
  assert.ok(encoded.tokens.length > 2, "Long unseen word should be split into subwords/characters");
  assert.ok(encoded.inputIds.every((id) => id >= 0), "All token IDs must be non-negative");
});

// ---------------------------------------------------------------------------
// 2. Model Specifications & 15M Parameter Architecture Verification
// ---------------------------------------------------------------------------
test("Model parameter specifications meet 10-20M parameter budget and INT8 size", () => {
  const paramStats = calculateParameterCount();

  console.log(`  - Total Parameters: ${(paramStats.totalParams / 1e6).toFixed(2)}M`);
  console.log(`  - INT8 Footprint: ${paramStats.memorySizeMb.toFixed(2)} MB`);

  assert.ok(
    paramStats.totalParams >= 10_000_000 && paramStats.totalParams <= 20_000_000,
    `Total parameters (${paramStats.totalParams}) must be within 10M-20M envelope`
  );
  assert.ok(
    paramStats.memorySizeMb <= 25.0,
    `INT8 Quantized memory size (${paramStats.memorySizeMb}MB) must be under 25MB`
  );
});

// ---------------------------------------------------------------------------
// 3. Inference Engine Latency Verification (< 50ms on CPU)
// ---------------------------------------------------------------------------
test("Forward inference tensor execution runs in sub-50ms on CPU without GPU", () => {
  const session = new SLMInferenceSession();
  const tokenizer = defaultTokenizer;

  const encoded = tokenizer.encode("launch my visual studio code", { maxSeqLen: 32 });

  // Warmup run
  session.run(encoded.inputIds, encoded.attentionMask);

  // Benchmarked runs
  const iterations = 10;
  let totalDuration = 0;

  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    const out = session.run(encoded.inputIds, encoded.attentionMask);
    const duration = performance.now() - t0;
    totalDuration += duration;

    assert.equal(out.intentLogits.length, 5, "Intent logits must have 5 classes");
    assert.equal(out.slotLogits.length, 32, "Slot logits must cover sequence length");
  }

  const avgLatency = totalDuration / iterations;
  console.log(`  - Average Inference Latency: ${avgLatency.toFixed(2)}ms (target < 50ms)`);

  assert.ok(
    avgLatency < 50.0,
    `Average inference latency (${avgLatency.toFixed(2)}ms) must be strictly less than 50ms`
  );
});

// ---------------------------------------------------------------------------
// 4. Intent Extraction & AST Slot Generation
// ---------------------------------------------------------------------------
await asyncTest("SLM extracts 'app.launch' intent and target slot correctly", async () => {
  const parser = new SLMIntentParser();
  const ast = await parser.parse("launch my visual studio code");

  assert.equal(ast.intent, "app.launch", "Intent should be app.launch");
  assert.ok(ast.confidence >= 0.5, "Confidence should be high (>= 0.5)");
  assert.equal(ast.command.skill, "openApp", "Skill must be openApp");
  assert.equal(ast.command.params.target, "visual studio code");
  assert.ok(ast.latencyMs < 50, "Parse latency must be sub-50ms");
});

await asyncTest("SLM extracts 'web.search' intent with query and provider slots", async () => {
  const parser = new SLMIntentParser();
  const ast = await parser.parse("look up weather tomorrow on google");

  assert.equal(ast.intent, "web.search", "Intent should be web.search");
  assert.ok(ast.confidence >= 0.5, "Confidence should be high (>= 0.5)");
  assert.equal(ast.command.skill, "browser", "Skill must be browser");
  assert.equal(ast.command.params.action, "search");
  assert.equal(ast.command.params.query, "weather tomorrow");
  assert.equal(ast.command.params.provider, "google");
});

await asyncTest("SLM extracts 'comm.message' intent with recipient and message slots", async () => {
  const parser = new SLMIntentParser();
  const ast = await parser.parse("message alex saying hello");

  assert.equal(ast.intent, "comm.message", "Intent should be comm.message");
  assert.ok(ast.confidence >= 0.5, "Confidence should be high (>= 0.5)");
  assert.equal(ast.command.skill, "whatsApp", "Skill must be whatsApp");
  assert.equal(ast.command.params.recipientName, "alex");
  assert.equal(ast.command.params.message, "hello");
});

// ---------------------------------------------------------------------------
// 5. Personalization Adapter (LoRA) On-Device Training Step
// ---------------------------------------------------------------------------
test("LoRA adapter learning step updates weights on-device and improves target score", () => {
  const adapter = new LoRAAdapterHead({ rank: 4, alpha: 8, inFeatures: 256, outFeatures: 5 });

  // Initial adapter contribution is 0
  const inputVector = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    inputVector[i] = Math.sin(i);
  }

  const initialDelta = adapter.forward(inputVector);
  for (let o = 0; o < 5; o++) {
    assert.equal(initialDelta[o], 0, "Initial LoRA delta must be exactly 0");
  }

  // Simulate base logits where target intent (index 0) has a low score
  const baseLogits = new Float32Array([-1.0, 2.0, 0.5, 0.0, -0.5]);
  const targetIndex = 0;

  // Train adapter on this specific input representation
  let lastProb = 0;
  for (let step = 0; step < 5; step++) {
    const res = adapter.trainStep(inputVector, targetIndex, baseLogits, 0.1);
    assert.ok(res.targetProb >= lastProb, "Target probability must monotonically improve with training");
    lastProb = res.targetProb;
  }

  // Verify adapted logits now favor target index
  const adapted = adapter.adapt(baseLogits, inputVector);
  assert.ok(
    adapted[targetIndex] > baseLogits[targetIndex],
    "Adapted logit for target index must be significantly higher than base logit"
  );

  // Verify weight export and import
  const exported = adapter.exportWeights();
  assert.equal(exported.rank, 4);
  assert.equal(exported.matrixA.length, 4 * 256);
  assert.equal(exported.matrixB.length, 5 * 4);

  const restoredAdapter = new LoRAAdapterHead();
  restoredAdapter.loadWeights(exported);
  const restoredDelta = restoredAdapter.forward(inputVector);
  assert.ok(Math.abs(restoredDelta[0] - adapter.forward(inputVector)[0]) < 1e-6);
});

await asyncTest("SLMIntentParser trains personalized phrase and changes prediction", async () => {
  const parser = new SLMIntentParser();
  const personalizedPhrase = "codeup project";

  // Train the model to associate this personalized phrase with app.launch
  const trainResult = parser.trainPersonalPhrase(personalizedPhrase, "app.launch", 0.1, 6);
  assert.ok(trainResult.finalProb > trainResult.initialProb, "Target probability should increase");
  assert.ok(trainResult.finalLoss <= trainResult.initialLoss, "Loss should decrease");

  const parsedAfter = await parser.parse(personalizedPhrase);
  assert.equal(parsedAfter.intent, "app.launch", "Trained personal phrase should map to app.launch");
  assert.equal(parsedAfter.command.skill, "openApp");
});

// ---------------------------------------------------------------------------
// 6. Dual-Path Integration in parsedResponse()
// ---------------------------------------------------------------------------
await asyncTest("Dual-Path intent parser routes exact commands fast and complex natural language to SLM", async () => {
  // Path 1: Fast deterministic regex
  const exactResult = await parsedResponse("open chrome");
  assert.equal(exactResult.type, "command");
  if (exactResult.type === "command") {
    assert.equal(exactResult.command.skill, "openApp");
    assert.equal(exactResult.command.params.target, "chrome");
  }

  // Path 2: Natural language phrases dispatched to SLM
  const slmResult1 = await parsedResponse("launch my visual studio code");
  assert.equal(slmResult1.type, "command");
  if (slmResult1.type === "command") {
    assert.equal(slmResult1.command.skill, "openApp");
    assert.equal(slmResult1.command.params.target, "visual studio code");
  }

  const slmResult2 = await parsedResponse("look up weather tomorrow on google");
  assert.equal(slmResult2.type, "command");
  if (slmResult2.type === "command") {
    assert.equal(slmResult2.command.skill, "browser");
    assert.equal(slmResult2.command.params.action, "search");
    assert.equal(slmResult2.command.params.query, "weather tomorrow");
  }

  const slmResult3 = await parsedResponse("message alex saying hello");
  assert.equal(slmResult3.type, "command");
  if (slmResult3.type === "command") {
    assert.equal(slmResult3.command.skill, "whatsApp");
    assert.equal(slmResult3.command.params.recipientName, "alex");
    assert.equal(slmResult3.command.params.message, "hello");
  }
});

console.log("\nALL SLM TESTS PASSED SUCCESSFULLY!");
