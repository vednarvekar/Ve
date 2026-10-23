# LLD: Federated Learning Client & Aggregation Specification

## 1. Overview & Math Foundations

The Federated Learning Client runs exclusively on opted-in machines, computing local weight updates on sanitized behavioral sequences and contributing to the **Federated Averaging (FedAvg)** round with Differential Privacy guarantees.

---

## 2. Mathematical Pipeline (Per-Client Update)

### Step 1: Local SGD / Fine-Tuning
Given base global model weights $W_t$ and local dataset $\mathcal{D}_k$ containing $n_k$ sanitized examples:
$$W_k^{(E)} = W_t - \eta \sum_{e=1}^{E} \nabla \mathcal{L}(W_k^{(e-1)}; B)$$

### Step 2: Weight Delta Calculation
$$\Delta W_k = W_k^{(E)} - W_t$$

### Step 3: $L_2$ Norm Clipping
Clamp the magnitude of update $\Delta W_k$ to a strict sensitivity bound $S$:
$$\Delta \bar{W}_k = \frac{\Delta W_k}{\max\left(1, \frac{\|\Delta W_k\|_2}{S}\right)}$$

### Step 4: Secure Share Masking
Before transmission, client generates masking vectors $r_k$ using Diffie-Hellman shared seeds with peers:
$$U_k = \Delta \bar{W}_k + \sum_{j \in \text{Peers}} r_{k,j} \pmod q$$
The coordinator sums all $U_k$; pairwise masks $r_{k,j}$ and $r_{j,k}$ cancel out exactly when the cohort quorom is met, revealing only:
$$\sum_{k=1}^K \Delta \bar{W}_k$$

---

## 3. Data Transfer Structures

```typescript
export const FED_PROTOCOL_VERSION = "2.0";

export interface FedRoundConfig {
  roundId: string;
  baseModelVersion: number;
  minCohortSize: number;       // e.g. 50 clients
  maxNormBound: number;        // L2 clipping bound S
  targetEpsilon: number;       // Differential privacy parameter
  targetDelta: number;
}

export interface FedClientContribution {
  protocolVersion: typeof FED_PROTOCOL_VERSION;
  roundId: string;
  clientNonce: string;         // Single-use random token (prevents replay)
  numLocalSamplesBucket: "10-50" | "50-100" | "100+"; // Coarse bucket, not exact count
  maskedWeightDeltas: Float32Array; // Flattened masked delta buffer
  signature: string;           // Client ephemeral session signature
}
```

---

## 4. Local Training Worker Execution Rules

```typescript
export interface DeviceReadinessCriteria {
  minBatteryPercent: number;    // e.g. 80% if on battery, or AC connected
  requireAcPower: boolean;      // true by default
  requireIdleCpu: boolean;      // CPU usage < 10% for last 3 minutes
  requireUserIdle: boolean;     // No active user keystrokes for 5 minutes
}

export class FederatedTrainerClient {
  public static async evaluateEligibility(criteria: DeviceReadinessCriteria): Promise<boolean> {
    // Check OS power state & idle metrics
    return true; // Simplified placeholder
  }

  public static async executeLocalTrainingRound(
    baseWeights: Float32Array,
    config: FedRoundConfig
  ): Promise<FedClientContribution | null> {
    // 1. Check user opt-in status in local SQLite preferences
    // 2. Verify eligibility (idle + AC power)
    // 3. Train on local behavior_events table
    // 4. Clip L2 norm to config.maxNormBound
    // 5. Package and return masked contribution
    return null;
  }
}
```

---

## 5. Aggregation & Verification Algorithm

On the coordinator server:

```typescript
export function aggregateRound(
  contributions: FedClientContribution[],
  config: FedRoundConfig
): Float32Array | null {
  if (contributions.length < config.minCohortSize) {
    return null; // Cohort threshold violated; abort round
  }

  const tensorLength = contributions[0].maskedWeightDeltas.length;
  const aggregatedDelta = new Float32Array(tensorLength);

  // FedAvg Summation
  for (let i = 0; i < tensorLength; i++) {
    let sum = 0;
    for (let c = 0; c < contributions.length; c++) {
      sum += contributions[c].maskedWeightDeltas[i];
    }
    // Inject Calibrated DP Gaussian Noise
    const dpNoise = sampleGaussianNoise(config.targetEpsilon, config.targetDelta);
    aggregatedDelta[i] = (sum / contributions.length) + dpNoise;
  }

  return aggregatedDelta;
}
```
