export const BEHAVIOR_ACTIONS = [
  "open_app:chrome",
  "open_app:firefox",
  "open_app:vscode",
  "open_app:calculator",
  "open_app:notepad",
  "open_app:terminal",
  "open_app:explorer",
  "open_app:whatsapp",
  "open_url",
  "web_search",
  "netflix_search",
  "whatsapp_message",
] as const;

export type BehaviorAction = typeof BEHAVIOR_ACTIONS[number];
export type TimeBand = 0 | 1 | 2 | 3;
export interface PredictionContext {
  timeBand: TimeBand;
  weekday: number;
  previousAction: BehaviorAction | null;
}
export interface BehaviorEvent extends PredictionContext {
  action: BehaviorAction;
}
export interface LocalModel {
  version: 1;
  weights: number[][];
}

const FEATURE_COUNT = 13 + BEHAVIOR_ACTIONS.length;
const ACTION_INDEX = new Map<string, number>(BEHAVIOR_ACTIONS.map((action, index) => [action, index]));

export function isBehaviorAction(value: string): value is BehaviorAction {
  return ACTION_INDEX.has(value);
}

export function newLocalModel(): LocalModel {
  return {
    version: 1,
    weights: BEHAVIOR_ACTIONS.map(() => Array<number>(FEATURE_COUNT).fill(0)),
  };
}

export function isLocalModel(value: unknown): value is LocalModel {
  if (!value || typeof value !== "object") return false;
  const model = value as Partial<LocalModel>;
  return model.version === 1
    && Array.isArray(model.weights)
    && model.weights.length === BEHAVIOR_ACTIONS.length
    && model.weights.every((row) => Array.isArray(row) && row.length === FEATURE_COUNT && row.every(Number.isFinite));
}

function features(context: PredictionContext): number[] {
  const vector = Array<number>(FEATURE_COUNT).fill(0);
  vector[0] = 1;
  vector[1 + Math.max(0, Math.min(3, Math.floor(context.timeBand)))] = 1;
  vector[5 + Math.max(0, Math.min(6, Math.floor(context.weekday)))] = 1;
  const previousIndex = context.previousAction ? ACTION_INDEX.get(context.previousAction) : undefined;
  if (previousIndex !== undefined) vector[13 + previousIndex] = 1;
  return vector;
}

function probabilities(model: LocalModel, input: number[]): number[] {
  const logits = model.weights.map((row) => row.reduce((sum, weight, index) => sum + weight * (input[index] ?? 0), 0));
  const maximum = Math.max(...logits);
  const exponentials = logits.map((value) => Math.exp(Math.max(-30, Math.min(30, value - maximum))));
  const total = exponentials.reduce((sum, value) => sum + value, 0) || 1;
  return exponentials.map((value) => value / total);
}

export function trainLocalModel(model: LocalModel, context: PredictionContext, action: BehaviorAction): LocalModel {
  const input = features(context);
  const target = ACTION_INDEX.get(action);
  if (target === undefined) return model;
  const predicted = probabilities(model, input);
  const learningRate = 0.16;
  const decay = 0.0005;
  const weights = model.weights.map((row, actionIndex) => row.map((weight, featureIndex) => {
    const gradient = ((actionIndex === target ? 1 : 0) - (predicted[actionIndex] ?? 0)) * (input[featureIndex] ?? 0);
    return weight * (1 - decay) + learningRate * gradient;
  }));
  return { version: 1, weights };
}

export function rankLocalPredictions(model: LocalModel, context: PredictionContext): Array<{ action: BehaviorAction; score: number }> {
  const scores = probabilities(model, features(context));
  return BEHAVIOR_ACTIONS
    .map((action, index) => ({ action, score: scores[index] ?? 0 }))
    .sort((a, b) => b.score - a.score);
}

export function contextForNow(previousAction: BehaviorAction | null, now = new Date()): PredictionContext {
  const hour = now.getHours();
  const timeBand: TimeBand = hour < 6 ? 0 : hour < 12 ? 1 : hour < 18 ? 2 : 3;
  return { timeBand, weekday: now.getDay(), previousAction };
}
