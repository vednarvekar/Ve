import { BEHAVIOR_ACTIONS } from "./localPredictor.js";
import type { LocalModel } from "./localPredictor.js";
import { isLocalModel } from "./localPredictor.js";

export const FEDERATED_MODEL_VERSION = 1;
export const MINIMUM_FEDERATED_CLIENTS = 3;
const MAX_CLIENT_NORM = 5;

/** A model-only client contribution. Raw behavior examples are never part of this shape. */
export interface FederatedModelUpdate {
  version: typeof FEDERATED_MODEL_VERSION;
  model: LocalModel;
}

/** Equal-weight, norm-clipped FedAvg prototype; requires a minimum cohort. */
export function aggregateFederatedModels(updates: FederatedModelUpdate[], minimumClients = MINIMUM_FEDERATED_CLIENTS): LocalModel | null {
  if (updates.length < Math.max(MINIMUM_FEDERATED_CLIENTS, minimumClients)) return null;
  if (updates.length > 10_000 || updates.some((update) => update.version !== FEDERATED_MODEL_VERSION || !isLocalModel(update.model))) return null;

  const clientScales = updates.map(({ model }) => {
    const squaredNorm = model.weights.reduce((sum, row) => sum + row.reduce((rowSum, value) => rowSum + value * value, 0), 0);
    const norm = Math.sqrt(squaredNorm);
    return norm > MAX_CLIENT_NORM ? MAX_CLIENT_NORM / norm : 1;
  });
  const rows = BEHAVIOR_ACTIONS.map(() => [] as number[]);
  for (let actionIndex = 0; actionIndex < BEHAVIOR_ACTIONS.length; actionIndex += 1) {
    const rowLength = updates[0]?.model.weights[actionIndex]?.length ?? 0;
    for (let featureIndex = 0; featureIndex < rowLength; featureIndex += 1) {
      const values = updates.map((update, clientIndex) => (update.model.weights[actionIndex]?.[featureIndex] ?? 0) * (clientScales[clientIndex] ?? 1));
      rows[actionIndex]?.push(values.reduce((sum, value) => sum + value, 0) / updates.length);
    }
  }
  return { version: 1, weights: rows };
}
