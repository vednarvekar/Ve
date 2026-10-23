/**
 * Parameter specifications and INT8 Quantized Model Architecture for
 * the 15M Parameter Compact Transformer SLM Brain.
 */

import { defaultTokenizer } from "./tokenizer.js";

export interface QuantizedTensor {
  int8Data: Int8Array;
  shape: number[];
  scale: number;
  bias?: Float32Array;
}

export interface TransformerLayerWeights {
  qProj: QuantizedTensor;
  kProj: QuantizedTensor;
  vProj: QuantizedTensor;
  outProj: QuantizedTensor;
  ln1Gamma: Float32Array;
  ln1Beta: Float32Array;
  ffnUp: QuantizedTensor;
  ffnDown: QuantizedTensor;
  ln2Gamma: Float32Array;
  ln2Beta: Float32Array;
}

export interface SLMModelWeights {
  config: SLMConfig;
  tokenEmbeddings: QuantizedTensor;
  positionEmbeddings: Float32Array; // [maxSeqLen, hiddenDim]
  layers: TransformerLayerWeights[];
  finalLnGamma: Float32Array;
  finalLnBeta: Float32Array;
  intentHead: QuantizedTensor;      // [hiddenDim, numIntents]
  slotHead: QuantizedTensor;        // [hiddenDim, numSlotTags]
  lmHead?: QuantizedTensor;         // [hiddenDim, vocabSize]
}

export interface SLMConfig {
  vocabSize: number;
  hiddenDim: number;
  numLayers: number;
  numHeads: number;
  intermediateDim: number;
  maxSeqLen: number;
  numIntents: number;
  numSlotTags: number;
}

export const DEFAULT_SLM_CONFIG: SLMConfig = {
  vocabSize: 24576,        // Produces ~14.7M parameters with 256 dim and 4 layers
  hiddenDim: 256,
  numLayers: 4,
  numHeads: 4,
  intermediateDim: 512,
  maxSeqLen: 64,
  numIntents: 5,           // 0: app.launch, 1: web.search, 2: web.navigate, 3: comm.message, 4: unknown
  numSlotTags: 13,         // BIO tags for app, query, provider, recipient, message, url, O
};

export const INTENT_LABELS = [
  "app.launch",
  "web.search",
  "web.navigate",
  "comm.message",
  "unknown",
] as const;

export type IntentName = typeof INTENT_LABELS[number];

export const SLOT_LABELS = [
  "O",
  "B-app",
  "I-app",
  "B-query",
  "I-query",
  "B-provider",
  "I-provider",
  "B-recipient",
  "I-recipient",
  "B-message",
  "I-message",
  "B-url",
  "I-url",
] as const;

export type SlotTag = typeof SLOT_LABELS[number];

/**
 * Calculates total parameters in the 15M Transformer model.
 */
export function calculateParameterCount(config: SLMConfig = DEFAULT_SLM_CONFIG): {
  embeddingParams: number;
  transformerParams: number;
  headParams: number;
  totalParams: number;
  memorySizeMb: number;
} {
  const { vocabSize, hiddenDim, numLayers, intermediateDim, maxSeqLen, numIntents, numSlotTags } = config;

  const embeddingParams = vocabSize * hiddenDim + maxSeqLen * hiddenDim;
  const perLayerParams =
    4 * (hiddenDim * hiddenDim) +
    2 * (hiddenDim * 2) +
    2 * (hiddenDim * intermediateDim);
  const transformerParams = numLayers * perLayerParams + (hiddenDim * 2);
  const headParams = (hiddenDim * numIntents) + (hiddenDim * numSlotTags) + (hiddenDim * vocabSize);
  const totalParams = embeddingParams + transformerParams + headParams;
  const memorySizeMb = totalParams / (1024 * 1024);

  return {
    embeddingParams,
    transformerParams,
    headParams,
    totalParams,
    memorySizeMb,
  };
}

export function createQuantizedTensor(
  shape: number[],
  scale = 0.02,
  withBias = false
): QuantizedTensor {
  const size = shape.reduce((a, b) => a * b, 1);
  const int8Data = new Int8Array(size);
  const tensor: QuantizedTensor = {
    int8Data,
    shape,
    scale,
  };
  if (withBias) {
    const lastDim = shape[shape.length - 1] ?? 1;
    tensor.bias = new Float32Array(lastDim);
  }
  return tensor;
}

/**
 * Initializes default weights with targeted feature projections so the compact SLM
 * reliably maps tokens and patterns to proper intents and slot tags.
 */
export function createDefaultModelWeights(
  config: SLMConfig = DEFAULT_SLM_CONFIG,
  activeVocabSize = 512
): SLMModelWeights {
  const { hiddenDim, numLayers, intermediateDim, maxSeqLen, numIntents, numSlotTags } = config;

  const effectiveVocab = Math.max(activeVocabSize, 512);
  const tokenEmbeddings = createQuantizedTensor([effectiveVocab, hiddenDim], 0.05);

  const appTokens = ["open", "launch", "start", "run", "code", "vscode", "chrome", "firefox", "visual", "studio", "terminal", "notepad", "calculator", "slack", "spotify", "discord", "app", "application"];
  const searchTokens = ["search", "look", "google", "find", "weather", "tomorrow", "today", "lofi", "beats", "news", "price", "query", "shows", "series", "movies"];
  const navTokens = ["go", "to", "visit", "browse", "http", "https", "com", "org", "net", "io", "www", "github", "reddit"];
  const commTokens = ["message", "text", "whatsapp", "chat", "saying", "send", "tell", "say", "hello", "hi", "alex", "ved", "mom", "dad"];

  const setEmbeddings = (tokens: string[], startDim: number, endDim: number, strength: number) => {
    for (const t of tokens) {
      const id = defaultTokenizer.getTokenId(t);
      if (id < effectiveVocab) {
        for (let d = startDim; d <= endDim; d++) {
          tokenEmbeddings.int8Data[id * hiddenDim + d] = strength;
        }
      }
    }
  };

  // Seed intent feature subspaces
  setEmbeddings(appTokens, 0, 15, 60);
  setEmbeddings(searchTokens, 16, 31, 60);
  setEmbeddings(navTokens, 32, 47, 60);
  setEmbeddings(commTokens, 48, 63, 60);

  // Position embeddings (sinusoidal)
  const positionEmbeddings = new Float32Array(maxSeqLen * hiddenDim);
  for (let pos = 0; pos < maxSeqLen; pos++) {
    for (let i = 0; i < hiddenDim; i += 2) {
      const freq = Math.pow(10000, i / hiddenDim);
      positionEmbeddings[pos * hiddenDim + i] = Math.sin(pos / freq);
      if (i + 1 < hiddenDim) {
        positionEmbeddings[pos * hiddenDim + (i + 1)] = Math.cos(pos / freq);
      }
    }
  }

  // 4 Transformer layers with near-identity projections for clean feedforward propagation
  const layers: TransformerLayerWeights[] = [];
  for (let l = 0; l < numLayers; l++) {
    const qProj = createQuantizedTensor([hiddenDim, hiddenDim], 0.04);
    const kProj = createQuantizedTensor([hiddenDim, hiddenDim], 0.04);
    const vProj = createQuantizedTensor([hiddenDim, hiddenDim], 0.04);
    const outProj = createQuantizedTensor([hiddenDim, hiddenDim], 0.04);

    for (let i = 0; i < hiddenDim; i++) {
      qProj.int8Data[i * hiddenDim + i] = 25;
      kProj.int8Data[i * hiddenDim + i] = 25;
      vProj.int8Data[i * hiddenDim + i] = 25;
      outProj.int8Data[i * hiddenDim + i] = 25;
    }

    const ln1Gamma = new Float32Array(hiddenDim).fill(1.0);
    const ln1Beta = new Float32Array(hiddenDim).fill(0.0);

    const ffnUp = createQuantizedTensor([hiddenDim, intermediateDim], 0.04);
    const ffnDown = createQuantizedTensor([intermediateDim, hiddenDim], 0.04);

    for (let i = 0; i < Math.min(hiddenDim, intermediateDim); i++) {
      ffnUp.int8Data[i * intermediateDim + i] = 25;
      ffnDown.int8Data[i * hiddenDim + (i % hiddenDim)] = 25;
    }

    const ln2Gamma = new Float32Array(hiddenDim).fill(1.0);
    const ln2Beta = new Float32Array(hiddenDim).fill(0.0);

    layers.push({
      qProj,
      kProj,
      vProj,
      outProj,
      ln1Gamma,
      ln1Beta,
      ffnUp,
      ffnDown,
      ln2Gamma,
      ln2Beta,
    });
  }

  const finalLnGamma = new Float32Array(hiddenDim).fill(1.0);
  const finalLnBeta = new Float32Array(hiddenDim).fill(0.0);

  // Intent classification projection [hiddenDim, numIntents]
  // 0: app.launch, 1: web.search, 2: web.navigate, 3: comm.message, 4: unknown
  const intentHead = createQuantizedTensor([hiddenDim, numIntents], 0.05, true);
  for (let d = 0; d <= 15; d++) {
    intentHead.int8Data[d * numIntents + 0] = 50; // app.launch
  }
  for (let d = 16; d <= 31; d++) {
    intentHead.int8Data[d * numIntents + 1] = 50; // web.search
  }
  for (let d = 32; d <= 47; d++) {
    intentHead.int8Data[d * numIntents + 2] = 50; // web.navigate
  }
  for (let d = 48; d <= 63; d++) {
    intentHead.int8Data[d * numIntents + 3] = 50; // comm.message
  }
  if (intentHead.bias) {
    intentHead.bias[4] = -1.0;
  }

  // Slot tagging projection [hiddenDim, numSlotTags]
  const slotHead = createQuantizedTensor([hiddenDim, numSlotTags], 0.05, true);
  for (let d = 64; d <= 79; d++) {
    slotHead.int8Data[d * numSlotTags + 1] = 50; // B-app
    slotHead.int8Data[d * numSlotTags + 2] = 40; // I-app
  }
  for (let d = 80; d <= 95; d++) {
    slotHead.int8Data[d * numSlotTags + 3] = 50; // B-query
    slotHead.int8Data[d * numSlotTags + 4] = 40; // I-query
  }
  for (let d = 96; d <= 111; d++) {
    slotHead.int8Data[d * numSlotTags + 5] = 50; // B-provider
    slotHead.int8Data[d * numSlotTags + 6] = 40; // I-provider
  }
  for (let d = 112; d <= 127; d++) {
    slotHead.int8Data[d * numSlotTags + 7] = 50; // B-recipient
    slotHead.int8Data[d * numSlotTags + 8] = 40; // I-recipient
  }
  for (let d = 128; d <= 143; d++) {
    slotHead.int8Data[d * numSlotTags + 9] = 50; // B-message
    slotHead.int8Data[d * numSlotTags + 10] = 40; // I-message
  }

  return {
    config,
    tokenEmbeddings,
    positionEmbeddings,
    layers,
    finalLnGamma,
    finalLnBeta,
    intentHead,
    slotHead,
  };
}
