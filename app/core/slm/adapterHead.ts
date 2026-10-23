/**
 * Low-Rank Adaptation (LoRA) Personalization Engine
 *
 * Implements a Rank r=4, Alpha=8 LoRA adapter layer attached to the SLM intent projection.
 * Allows on-device fine-tuning from user shorthand and personalized interactions
 * without modifying or forgetting frozen base weights.
 */

export interface LoRAConfig {
  rank: number;       // r = 4
  alpha: number;      // alpha = 8
  inFeatures: number; // hiddenDim = 256
  outFeatures: number;// numIntents = 5
}

export interface SerializedLoRAWeights {
  rank: number;
  alpha: number;
  inFeatures: number;
  outFeatures: number;
  matrixA: number[];
  matrixB: number[];
  trainStepCount: number;
}

export class LoRAAdapterHead {
  public readonly config: LoRAConfig;
  public readonly scale: number;

  // matrixA: [rank, inFeatures] (down-projection)
  public matrixA: Float32Array;
  // matrixB: [outFeatures, rank] (up-projection)
  public matrixB: Float32Array;

  private trainStepCount = 0;

  constructor(config: Partial<LoRAConfig> = {}) {
    this.config = {
      rank: config.rank ?? 4,
      alpha: config.alpha ?? 8,
      inFeatures: config.inFeatures ?? 256,
      outFeatures: config.outFeatures ?? 5,
    };

    this.scale = this.config.alpha / this.config.rank; // 8 / 4 = 2.0
    this.matrixA = new Float32Array(this.config.rank * this.config.inFeatures);
    this.matrixB = new Float32Array(this.config.outFeatures * this.config.rank);

    this.initializeWeights();
  }

  /**
   * Standard LoRA initialization:
   * Matrix A is initialized with small random values.
   * Matrix B is initialized to zero so the initial adapter contribution is exactly 0.
   */
  public initializeWeights(): void {
    const { rank, inFeatures, outFeatures } = this.config;

    // Small pseudo-random Gaussian-like initialization for A
    for (let i = 0; i < rank * inFeatures; i++) {
      this.matrixA[i] = (Math.sin(i * 12.9898 + 78.233) * 0.05);
    }

    // Matrix B initialized to zero
    this.matrixB.fill(0.0);
    this.trainStepCount = 0;
  }

  /**
   * Forward pass through LoRA:
   * u = A * h
   * delta = scale * (B * u)
   * returns deltaLogits of size outFeatures
   */
  public forward(inputRepresentation: Float32Array): Float32Array {
    const { rank, inFeatures, outFeatures } = this.config;
    const u = new Float32Array(rank);

    // 1. Down-projection: u = A * h
    for (let r = 0; r < rank; r++) {
      let sum = 0.0;
      const rowOffset = r * inFeatures;
      for (let j = 0; j < inFeatures; j++) {
        sum += (this.matrixA[rowOffset + j] ?? 0) * (inputRepresentation[j] ?? 0);
      }
      u[r] = sum;
    }

    // 2. Up-projection with scaling: delta = scale * (B * u)
    const deltaLogits = new Float32Array(outFeatures);
    for (let o = 0; o < outFeatures; o++) {
      let sum = 0.0;
      const rowOffset = o * rank;
      for (let r = 0; r < rank; r++) {
        sum += (this.matrixB[rowOffset + r] ?? 0) * (u[r] ?? 0);
      }
      deltaLogits[o] = sum * this.scale;
    }

    return deltaLogits;
  }

  /**
   * Applies LoRA adaptation to base intent logits:
   * adaptedLogits = baseLogits + LoRA(inputRepresentation)
   */
  public adapt(baseLogits: Float32Array, inputRepresentation: Float32Array): Float32Array {
    const delta = this.forward(inputRepresentation);
    const adapted = new Float32Array(baseLogits.length);
    for (let i = 0; i < baseLogits.length; i++) {
      adapted[i] = (baseLogits[i] ?? 0) + (delta[i] ?? 0);
    }
    return adapted;
  }

  /**
   * Local on-device training step using cross-entropy loss:
   * updates matrixA and matrixB via SGD backpropagation.
   */
  public trainStep(
    inputRepresentation: Float32Array,
    targetIndex: number,
    baseLogits?: Float32Array,
    learningRate = 0.05
  ): { loss: number; targetProb: number; adaptedLogits: Float32Array } {
    const { rank, inFeatures, outFeatures } = this.config;

    if (targetIndex < 0 || targetIndex >= outFeatures) {
      throw new Error(`Target index ${targetIndex} is out of bounds for ${outFeatures} intents`);
    }

    // 1. Forward Pass
    const u = new Float32Array(rank);
    for (let r = 0; r < rank; r++) {
      let sum = 0.0;
      const rowOffset = r * inFeatures;
      for (let j = 0; j < inFeatures; j++) {
        sum += (this.matrixA[rowOffset + j] ?? 0) * (inputRepresentation[j] ?? 0);
      }
      u[r] = sum;
    }

    const adaptedLogits = new Float32Array(outFeatures);
    for (let o = 0; o < outFeatures; o++) {
      let sum = 0.0;
      const rowOffset = o * rank;
      for (let r = 0; r < rank; r++) {
        sum += (this.matrixB[rowOffset + r] ?? 0) * (u[r] ?? 0);
      }
      const base = baseLogits ? (baseLogits[o] ?? 0) : 0;
      adaptedLogits[o] = base + sum * this.scale;
    }

    // 2. Compute Softmax Probabilities
    let maxLogit = -Infinity;
    for (let i = 0; i < outFeatures; i++) {
      if ((adaptedLogits[i] ?? 0) > maxLogit) {
        maxLogit = adaptedLogits[i] ?? 0;
      }
    }

    let expSum = 0.0;
    const probs = new Float32Array(outFeatures);
    for (let i = 0; i < outFeatures; i++) {
      const expVal = Math.exp((adaptedLogits[i] ?? 0) - maxLogit);
      probs[i] = expVal;
      expSum += expVal;
    }
    for (let i = 0; i < outFeatures; i++) {
      probs[i] = (probs[i] ?? 0) / expSum;
    }

    const targetProb = probs[targetIndex] ?? 0;
    const loss = -Math.log(Math.max(targetProb, 1e-12));

    // 3. Compute Gradients
    // g_o = p_o - y_o
    const g = new Float32Array(outFeatures);
    for (let o = 0; o < outFeatures; o++) {
      g[o] = (probs[o] ?? 0) - (o === targetIndex ? 1.0 : 0.0);
    }

    // dL/dB_{o, r} = scale * g_o * u_r
    // dL/du_r = scale * sum_o (B_{o, r} * g_o)
    const gradU = new Float32Array(rank);
    for (let r = 0; r < rank; r++) {
      let sum = 0.0;
      for (let o = 0; o < outFeatures; o++) {
        sum += (this.matrixB[o * rank + r] ?? 0) * (g[o] ?? 0);
      }
      gradU[r] = sum * this.scale;
    }

    // 4. Update B: B = B - lr * gradB
    for (let o = 0; o < outFeatures; o++) {
      const gVal = g[o] ?? 0;
      const rowOffset = o * rank;
      for (let r = 0; r < rank; r++) {
        const gradB = this.scale * gVal * (u[r] ?? 0);
        const currentB = this.matrixB[rowOffset + r] ?? 0;
        this.matrixB[rowOffset + r] = currentB - learningRate * gradB;
      }
    }

    // 5. Update A: A = A - lr * gradA (gradA_{r, j} = gradU_r * h_j)
    for (let r = 0; r < rank; r++) {
      const uGrad = gradU[r] ?? 0;
      const rowOffset = r * inFeatures;
      for (let j = 0; j < inFeatures; j++) {
        const gradA = uGrad * (inputRepresentation[j] ?? 0);
        const currentA = this.matrixA[rowOffset + j] ?? 0;
        this.matrixA[rowOffset + j] = currentA - learningRate * gradA;
      }
    }

    this.trainStepCount++;

    return {
      loss,
      targetProb,
      adaptedLogits,
    };
  }

  public getStepsCount(): number {
    return this.trainStepCount;
  }

  public exportWeights(): SerializedLoRAWeights {
    return {
      rank: this.config.rank,
      alpha: this.config.alpha,
      inFeatures: this.config.inFeatures,
      outFeatures: this.config.outFeatures,
      matrixA: Array.from(this.matrixA),
      matrixB: Array.from(this.matrixB),
      trainStepCount: this.trainStepCount,
    };
  }

  public loadWeights(weights: SerializedLoRAWeights): void {
    if (
      weights.rank !== this.config.rank ||
      weights.inFeatures !== this.config.inFeatures ||
      weights.outFeatures !== this.config.outFeatures
    ) {
      throw new Error("Serialized LoRA weights configuration does not match current model config.");
    }
    this.matrixA.set(weights.matrixA);
    this.matrixB.set(weights.matrixB);
    this.trainStepCount = weights.trainStepCount;
  }
}
