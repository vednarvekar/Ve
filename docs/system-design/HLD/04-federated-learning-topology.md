# HLD 04: Federated Learning Topology & Privacy Architecture

## 1. Core Principle

Ve is **local-first**. The assistant does not require federated learning to operate. Federated learning serves exclusively as an opt-in collective intelligence loop: improving base SLM intent understanding and action prediction models across devices **without centralizing user activity, text, or behavior**.

```
Client Machine 1 (Trains locally) ──> [Norm Clip + Noise] ──┐
Client Machine 2 (Trains locally) ──> [Norm Clip + Noise] ──┼──> [Secure Aggregation Server] ──> New Global Base SLM
Client Machine 3 (Trains locally) ──> [Norm Clip + Noise] ──┘
```

---

## 2. Federated Training Architecture

```mermaid
sequenceDiagram
    autonumber
    actor User as Client User
    participant ClientApp as Ve Desktop App
    participant LocalTrainer as Local Trainer Thread
    participant FedCoord as Federated Coordinator Server

    FedCoord->>ClientApp: Broadcast Round Proposal (Model v1.4, Min Cohort = 50)
    Note over ClientApp: Check: Is User Opted In? Device on AC power & Idle?
    ClientApp->>LocalTrainer: Initiate Local Epochs on Sanitized Context Buffer
    LocalTrainer->>LocalTrainer: Compute Gradients / LoRA Weight Deltas
    LocalTrainer->>LocalTrainer: Apply L2-Norm Clipping (Max Norm = C)
    LocalTrainer->>LocalTrainer: Inject Differential Privacy (Gaussian Noise)
    LocalTrainer-->>ClientApp: Return Encrypted Model Update Delta
    ClientApp->>FedCoord: Upload Masked/Encrypted Delta (Zero Raw Data)
    Note over FedCoord: Aggregate cohort updates once >= Min Cohort reached
    FedCoord->>FedCoord: Run FedAvg / Secure Aggregation
    FedCoord->>FedCoord: Evaluate on Benchmark Test Suite & Sign Artifact
    FedCoord->>ClientApp: Distribute Signed Global Model Update (v1.5)
    ClientApp->>ClientApp: Verify Signature & Local Performance Benchmark
    ClientApp->>ClientApp: Swap Base SLM Model Weights
```

---

## 3. Privacy Guarantees & Safeguards

### What Leaves the Device vs. What Stays

| Artifact | Stays on Device | Sent to Coordinator |
|---|---|---|
| **Raw Utterances & Prompts** | **Yes** (100% Local) | Never |
| **Contact Names & Phone Numbers** | **Yes** (100% Local) | Never |
| **Browsing URLs & Search Queries** | **Yes** (100% Local) | Never |
| **App Paths & Window Titles** | **Yes** (100% Local) | Never |
| **Local Behavioral Timestamps** | **Yes** (100% Local) | Never |
| **Model Weight Deltas ($\Delta W$)** | Filtered & Clipped | **Only Masked/Encrypted Deltas** |

### Mathematical Privacy Protections
1. **$L_2$ Norm Clipping**:
   Before transmission, local weight updates $\Delta W_k$ are clipped by a threshold $S$:
   $$\Delta \bar{W}_k = \Delta W_k \cdot \min\left(1, \frac{S}{\|\Delta W_k\|_2}\right)$$
   This prevents any individual user's update from exerting disproportionate influence or encoding specific raw training examples.
2. **Differential Privacy (DP-FedAvg)**:
   Calibrated Gaussian noise $\mathcal{N}(0, \sigma^2 S^2)$ is added to the aggregated sum to provide mathematically proven $(\epsilon, \delta)$-differential privacy bounds.
3. **Cohort Gating**:
   A round is rejected and aborted unless at least $K \ge 50$ distinct client updates participate in the aggregation round.

---

## 4. Federated Aggregator Topology

```mermaid
graph LR
    subgraph ClientPool ["Opted-In Desktop Clients"]
        C1[Client 1]
        C2[Client 2]
        C3[Client 3]
        Cn[Client n...]
    end

    subgraph CoordinatorNode ["Federated Coordinator Infrastructure"]
        Gatekeeper[Round Authenticator & Quorum Checker]
        SecAgg[Secure Aggregation Engine]
        Benchmarker[Regression & Benchmark Validator]
        Signer[Model Signing Authority]
        Distributor[CDN / Static Model Release Server]
    end

    C1 -->|Masked Update| Gatekeeper
    C2 -->|Masked Update| Gatekeeper
    C3 -->|Masked Update| Gatekeeper
    Cn -->|Masked Update| Gatekeeper

    Gatekeeper -->|Quorum >= K| SecAgg
    SecAgg --> Benchmarker
    Benchmarker -->|Benchmark Score >= Target| Signer
    Signer --> Distributor
    Distributor -.->|Download Signed Weights| C1
    Distributor -.->|Download Signed Weights| C2
```

---

## 5. Security & Threat Mitigation

| Threat Vector | Mitigation Strategy |
|---|---|
| **Model Poisoning / Sybil Attack** | Update magnitude clipping, robust aggregation (e.g. Coordinate-wise Median / Trimmed Mean instead of naive mean), and strict client rate limits. |
| **Inversion Attack (Reconstructing data from weights)** | Secure multi-party computation / secret sharing during aggregation so the coordinator never sees individual unmasked client weights. |
| **Malicious Global Model Distribution** | All distributed models are cryptographically signed using an asymmetric public-private key pair; clients reject unsigned model blobs. |
| **Resource Drain on Client Laptop** | Local training triggers only when: (1) battery is $>80\%$ or device is plugged in, and (2) CPU has been idle for $>5$ minutes. |
