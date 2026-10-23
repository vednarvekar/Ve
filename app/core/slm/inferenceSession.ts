/**
 * Fast CPU-optimized Tensor Computation Engine & SLM Inference Session
 *
 * Implements pure JS/Node matrix operations (quantized GEMM, LayerNorm,
 * Multi-Head Scaled Dot-Product Attention, GELU Feed-Forward, and Softmax)
 * running in sub-50ms on modern CPUs without discrete GPU requirements.
 */

import {
  type QuantizedTensor,
  type SLMModelWeights,
  createDefaultModelWeights,
} from "./modelWeights.js";

export interface SLMInferenceOutput {
  intentLogits: Float32Array;
  slotLogits: Float32Array[];
  pooledRepresentation: Float32Array;
  hiddenStates: Float32Array[];
  latencyMs: number;
}

export class SLMInferenceSession {
  private weights: SLMModelWeights;

  constructor(weights?: SLMModelWeights) {
    this.weights = weights ?? createDefaultModelWeights();
  }

  public getModelWeights(): SLMModelWeights {
    return this.weights;
  }

  /**
   * High-performance cache-friendly vector-matrix multiplication for INT8 Quantized weights.
   * Traverses weights contiguously along rows to maximize L1/L2 cache locality and V8 SIMD autovectorization.
   */
  public static quantizedMatVec(
    x: Float32Array,
    weight: QuantizedTensor,
    bias?: Float32Array
  ): Float32Array {
    const rows = weight.shape[0] ?? 0;
    const cols = weight.shape[1] ?? 0;
    const scale = weight.scale;
    const data = weight.int8Data;

    const out = new Float32Array(cols);

    // Contiguous row-major memory traversal
    for (let r = 0; r < rows; r++) {
      const xr = x[r] ?? 0;
      if (xr === 0) continue;
      const rowOffset = r * cols;
      for (let c = 0; c < cols; c++) {
        out[c] = (out[c] ?? 0) + xr * (data[rowOffset + c] ?? 0);
      }
    }

    if (bias) {
      for (let c = 0; c < cols; c++) {
        out[c] = (out[c] ?? 0) * scale + (bias[c] ?? 0);
      }
    } else {
      for (let c = 0; c < cols; c++) {
        out[c] = (out[c] ?? 0) * scale;
      }
    }

    return out;
  }

  /**
   * Layer Normalization: y = gamma * (x - mean) / sqrt(variance + eps) + beta
   */
  public static layerNorm(
    x: Float32Array,
    gamma: Float32Array,
    beta: Float32Array,
    eps = 1e-5
  ): Float32Array {
    const len = x.length;
    let mean = 0.0;
    for (let i = 0; i < len; i++) {
      mean += x[i] ?? 0;
    }
    mean /= len;

    let variance = 0.0;
    for (let i = 0; i < len; i++) {
      const diff = (x[i] ?? 0) - mean;
      variance += diff * diff;
    }
    variance /= len;

    const invStd = 1.0 / Math.sqrt(variance + eps);
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      out[i] = ((x[i] ?? 0) - mean) * invStd * (gamma[i] ?? 1.0) + (beta[i] ?? 0.0);
    }
    return out;
  }

  /**
   * Fast GELU activation function approximation: 0.5 * x * (1 + tanh(sqrt(2/pi) * (x + 0.044715 * x^3)))
   */
  public static gelu(x: Float32Array): Float32Array {
    const len = x.length;
    const out = new Float32Array(len);
    const sqrt2OverPi = 0.7978845608;
    for (let i = 0; i < len; i++) {
      const val = x[i] ?? 0;
      const cube = 0.044715 * val * val * val;
      out[i] = 0.5 * val * (1.0 + Math.tanh(sqrt2OverPi * (val + cube)));
    }
    return out;
  }

  /**
   * Numerically stable Softmax
   */
  public static softmax(logits: Float32Array | number[]): Float32Array {
    let max = -Infinity;
    const len = logits.length;
    for (let i = 0; i < len; i++) {
      const val = logits[i] ?? 0;
      if (val > max) max = val;
    }

    let sum = 0.0;
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const exp = Math.exp((logits[i] ?? 0) - max);
      out[i] = exp;
      sum += exp;
    }

    const safeSum = sum > 0 ? sum : 1.0;
    for (let i = 0; i < len; i++) {
      out[i] = (out[i] ?? 0) / safeSum;
    }
    return out;
  }

  public static argMax(arr: Float32Array | number[]): number {
    let maxIdx = 0;
    let maxVal = -Infinity;
    const len = arr.length;
    for (let i = 0; i < len; i++) {
      const val = arr[i] ?? 0;
      if (val > maxVal) {
        maxVal = val;
        maxIdx = i;
      }
    }
    return maxIdx;
  }

  /**
   * Executes an ultra-fast forward pass through the compact INT8 Transformer.
   * Focuses compute on active non-pad tokens for optimal sub-50ms CPU latency.
   */
  public run(inputIds: Int32Array, attentionMask: Int32Array): SLMInferenceOutput {
    const startTime = performance.now();
    const fullSeqLen = inputIds.length;

    // Find active sequence length (trim unnecessary pad token processing)
    let activeLen = 0;
    for (let i = 0; i < fullSeqLen; i++) {
      if ((attentionMask[i] ?? 0) === 1) {
        activeLen = i + 1;
      }
    }
    if (activeLen === 0) activeLen = 1;

    const config = this.weights.config;
    const hiddenDim = config.hiddenDim;
    const numHeads = config.numHeads;
    const headDim = hiddenDim / numHeads; // 256 / 4 = 64
    const scaleFactor = 1.0 / Math.sqrt(headDim);

    // 1. Token + Position Embeddings Lookup (for active tokens)
    const hiddenStates: Float32Array[] = new Array(activeLen);
    const tokenEmb = this.weights.tokenEmbeddings;
    const posEmb = this.weights.positionEmbeddings;
    const embRows = tokenEmb.shape[0] ?? 0;
    const embCols = tokenEmb.shape[1] ?? hiddenDim;
    const embScale = tokenEmb.scale;

    for (let t = 0; t < activeLen; t++) {
      const vec = new Float32Array(hiddenDim);
      const id = inputIds[t] ?? 0;
      if (id >= 0 && id < embRows) {
        const offset = id * embCols;
        for (let d = 0; d < hiddenDim; d++) {
          vec[d] = (tokenEmb.int8Data[offset + d] ?? 0) * embScale;
        }
      }
      const posOffset = Math.min(t, config.maxSeqLen - 1) * hiddenDim;
      for (let d = 0; d < hiddenDim; d++) {
        vec[d] = (vec[d] ?? 0) + (posEmb[posOffset + d] ?? 0);
      }
      hiddenStates[t] = vec;
    }

    // 2. Transformer Layer Stack (4 layers)
    for (const layer of this.weights.layers) {
      // Step A: Pre-Attention LayerNorm
      const normedAttnInputs: Float32Array[] = new Array(activeLen);
      for (let t = 0; t < activeLen; t++) {
        normedAttnInputs[t] = SLMInferenceSession.layerNorm(
          hiddenStates[t]!,
          layer.ln1Gamma,
          layer.ln1Beta
        );
      }

      // Step B: Project Q, K, V for active tokens
      const qVecs: Float32Array[] = new Array(activeLen);
      const kVecs: Float32Array[] = new Array(activeLen);
      const vVecs: Float32Array[] = new Array(activeLen);

      for (let t = 0; t < activeLen; t++) {
        qVecs[t] = SLMInferenceSession.quantizedMatVec(normedAttnInputs[t]!, layer.qProj);
        kVecs[t] = SLMInferenceSession.quantizedMatVec(normedAttnInputs[t]!, layer.kProj);
        vVecs[t] = SLMInferenceSession.quantizedMatVec(normedAttnInputs[t]!, layer.vProj);
      }

      // Step C: Multi-Head Scaled Dot-Product Attention
      const attnOutputs: Float32Array[] = new Array(activeLen);
      for (let t = 0; t < activeLen; t++) {
        const tokenAttnOut = new Float32Array(hiddenDim);

        for (let h = 0; h < numHeads; h++) {
          const headOffset = h * headDim;
          const scores = new Float32Array(activeLen);

          // Dot product: q_t * k_s
          const q = qVecs[t]!;
          for (let s = 0; s < activeLen; s++) {
            let dot = 0.0;
            const k = kVecs[s]!;
            for (let d = 0; d < headDim; d++) {
              dot += (q[headOffset + d] ?? 0) * (k[headOffset + d] ?? 0);
            }
            scores[s] = dot * scaleFactor;
          }

          const attnProbs = SLMInferenceSession.softmax(scores);

          // Weighted sum of V
          for (let d = 0; d < headDim; d++) {
            let weightedV = 0.0;
            for (let s = 0; s < activeLen; s++) {
              const v = vVecs[s]!;
              weightedV += (attnProbs[s] ?? 0) * (v[headOffset + d] ?? 0);
            }
            tokenAttnOut[headOffset + d] = weightedV;
          }
        }

        // Project heads through outProj
        const projectedAttn = SLMInferenceSession.quantizedMatVec(tokenAttnOut, layer.outProj);

        // Residual connection
        const residual = new Float32Array(hiddenDim);
        const currentH = hiddenStates[t]!;
        for (let d = 0; d < hiddenDim; d++) {
          residual[d] = (currentH[d] ?? 0) + (projectedAttn[d] ?? 0);
        }
        attnOutputs[t] = residual;
      }

      // Step D: Feed-Forward Network with Residual Connection
      for (let t = 0; t < activeLen; t++) {
        const xResidual = attnOutputs[t]!;
        const normedFfn = SLMInferenceSession.layerNorm(xResidual, layer.ln2Gamma, layer.ln2Beta);
        const up = SLMInferenceSession.quantizedMatVec(normedFfn, layer.ffnUp);
        const activated = SLMInferenceSession.gelu(up);
        const down = SLMInferenceSession.quantizedMatVec(activated, layer.ffnDown);

        const finalH = new Float32Array(hiddenDim);
        for (let d = 0; d < hiddenDim; d++) {
          finalH[d] = (xResidual[d] ?? 0) + (down[d] ?? 0);
        }
        hiddenStates[t] = finalH;
      }
    }

    // 3. Final Layer Normalization
    for (let t = 0; t < activeLen; t++) {
      hiddenStates[t] = SLMInferenceSession.layerNorm(
        hiddenStates[t]!,
        this.weights.finalLnGamma,
        this.weights.finalLnBeta
      );
    }

    // 4. Mean Pooling across active tokens
    const pooledRepresentation = new Float32Array(hiddenDim);
    for (let t = 0; t < activeLen; t++) {
      const h = hiddenStates[t]!;
      for (let d = 0; d < hiddenDim; d++) {
        pooledRepresentation[d] = (pooledRepresentation[d] ?? 0) + (h[d] ?? 0);
      }
    }
    for (let d = 0; d < hiddenDim; d++) {
      pooledRepresentation[d] = (pooledRepresentation[d] ?? 0) / activeLen;
    }

    // 5. Intent Logits Projection
    const intentLogits = SLMInferenceSession.quantizedMatVec(
      pooledRepresentation,
      this.weights.intentHead,
      this.weights.intentHead.bias
    );

    // 6. Slot Logits Projection for all sequence tokens
    const slotLogits: Float32Array[] = new Array(fullSeqLen);
    const zeroSlotLogits = new Float32Array(config.numSlotTags);
    for (let t = 0; t < fullSeqLen; t++) {
      if (t < activeLen) {
        slotLogits[t] = SLMInferenceSession.quantizedMatVec(
          hiddenStates[t]!,
          this.weights.slotHead,
          this.weights.slotHead.bias
        );
      } else {
        slotLogits[t] = zeroSlotLogits;
      }
    }

    const latencyMs = performance.now() - startTime;

    return {
      intentLogits,
      slotLogits,
      pooledRepresentation,
      hiddenStates,
      latencyMs,
    };
  }
}
