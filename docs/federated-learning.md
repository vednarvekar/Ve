# Ve — Federated Learning Design

## 1. Objective

Federated learning should improve prediction of useful, low-risk assistant behavior across devices while keeping raw user events on the device. The first experiment should be narrow: predict a likely next action or suggestion from coarse context. It should not attempt to train a general-purpose Jarvis model.

## 2. What is learned

The initial target is a recommendation model with inputs such as:

- coarse time bucket and day-of-week;
- recent action category, not raw command text;
- previous outcome category;
- local opt-in feature flags;
- optional coarse app category, only if the user enables it.

The target can be a ranked action category or a probability that a suggestion will be accepted. Raw transcripts, URLs, window titles, keystrokes, file paths, contact names, and credentials are excluded from federated features.

## 3. Local learning loop

```text
local events
  -> consent and retention filter
  -> feature extraction on device
  -> local train/evaluate
  -> minimum-example and quality checks
  -> privacy mechanism
  -> encrypted update package
  -> server aggregation
  -> signed global model
  -> device download and local validation
```

The device must be able to disable participation, delete local learning data, and continue using the assistant without training or synchronization.

## 4. Privacy model

“Encrypted updates” alone are not sufficient: an aggregator may still infer information from an individual update, and model updates can leak training signals. The design should evaluate these protections explicitly:

- secure aggregation so the server receives only an aggregate from a cohort;
- minimum cohort size before an aggregate is released;
- update clipping and differential privacy noise where the utility/privacy tradeoff is acceptable;
- authenticated transport and signed model artifacts;
- no raw event upload, no per-user model publication, and no server-side reconstruction of a user's history.

The privacy budget, cohort threshold, retention period, and threat model must be documented before real user data is used.

## 5. Proposed protocol

The first production-like experiment can use a round-based protocol:

1. Server publishes a model version and training configuration.
2. An opted-in client downloads the signed model and verifies compatibility.
3. The client trains locally for a bounded number of steps on an approved feature dataset.
4. The client clips the update, applies the agreed privacy transform, encrypts it for secure aggregation, and sends only the update package.
5. The server accepts updates only from an eligible cohort and aggregates them.
6. The server evaluates the candidate global model on a non-sensitive benchmark and signs the result.
7. Clients download the new model, run a local regression check, and activate it only if valid.

The first implementation may use a simulated multi-client environment on synthetic data. This validates the protocol and evaluation code without collecting personal events.

## 6. Update package

The protocol should carry only metadata needed for safe aggregation:

```text
protocolVersion
baseModelVersion
roundId
clientSoftwareVersion
featureSchemaVersion
clippedUpdate or secure-aggregation share
localExampleCount bucket
localEvaluation metrics bucket (optional)
```

Exact counts, raw features, raw commands, device identifiers, and stable user identifiers should not be included. Avoid a permanent device ID; if participation accounting requires unlinkability-resistant tokens, document the tradeoff separately.

## 7. Evaluation

Federation is successful only if it improves a defined metric without unacceptable privacy or product regressions. Track:

- top-k suggestion accuracy;
- suggestion acceptance rate;
- false-positive and dismissal rate;
- calibration of confidence scores;
- single-device model versus global model;
- communication size and training time;
- privacy parameters and cohort sizes;
- performance for new or low-data clients.

The product rule is conservative: a wrong proactive suggestion is worse than no suggestion. The model must therefore be calibrated and gated by a high-confidence threshold.

## 8. Open research decisions

- centralized coordinator versus a managed FL framework;
- secure aggregation implementation and failure recovery;
- differential privacy mechanism and budget;
- whether the first model should be federated at all, or remain local until utility is demonstrated;
- how model poisoning, Sybil clients, and malicious updates are detected;
- how users inspect, pause, reset, and leave a training round;
- whether cross-user generalization is useful for a highly personal action vocabulary.

## 9. Current code status

The repository now contains a local multinomial predictor in `app/core/prediction/localPredictor.ts` and an equal-weight, norm-clipped FedAvg primitive in `app/core/prediction/federated.ts`. The local store retains only successful action categories plus coarse time/day and previous-action context; command text and sensitive parameters are excluded. The UI can erase these behavior samples and the local model. Contacts and notes that a user explicitly adds are stored separately and preserved.

Federated aggregation is not connected to a server and no model updates leave the device. The current FedAvg function is not secure aggregation and does not provide differential privacy; it is a tested algorithm prototype, not a production privacy guarantee. Real cross-device learning still requires the safeguards and coordination described above.

