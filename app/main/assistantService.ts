import {
  contextForNow,
  isBehaviorAction,
  rankLocalPredictions,
  type BehaviorAction,
} from "../core/prediction/localPredictor.js";
import {
  getDefaultStore,
  listContacts as storeListContacts,
  addContact as storeAddContact,
  deleteContact as storeDeleteContact,
  listMemories as storeListMemories,
  addMemory as storeAddMemory,
  deleteMemory as storeDeleteMemory,
  recordTrainingSample as storeRecordTrainingSample,
  getTrainingDataset as storeGetTrainingDataset,
  clearBehaviorData as storeClearBehaviorData,
  type Contact,
  type Memory,
} from "../core/storage/index.js";

export type { Contact, Memory };

const ACTION_COMMANDS: Partial<Record<BehaviorAction, string>> = {
  "open_app:chrome": "Open Chrome",
  "open_app:firefox": "Open Firefox",
  "open_app:vscode": "Open VS Code",
  "open_app:calculator": "Open Calculator",
  "open_app:notepad": "Open Notepad",
  "open_app:terminal": "Open Terminal",
  "open_app:explorer": "Open File Explorer",
  "open_app:whatsapp": "Open WhatsApp",
};

export async function listMemories(): Promise<Memory[]> {
  return storeListMemories();
}

export async function addMemory(text: string): Promise<Memory> {
  return storeAddMemory(text);
}

export async function deleteMemory(id: string): Promise<void> {
  return storeDeleteMemory(id);
}

export async function listContacts(): Promise<Contact[]> {
  return storeListContacts();
}

export async function addContact(name: string, phone: string): Promise<Contact> {
  return storeAddContact(name, phone);
}

export async function deleteContact(id: string): Promise<void> {
  return storeDeleteContact(id);
}

/**
 * Records a user interaction as a training sample and updates the local predictive model.
 */
export async function recordTrainingSample(
  input: string,
  action: string,
  params: Record<string, unknown> = {},
  outcome: "success" | "failure" = "success"
) {
  return storeRecordTrainingSample(input, action, params, outcome);
}

/**
 * Backward-compatible helper for recording behavior.
 */
export async function recordBehavior(
  actionValue: string,
  input: string = "",
  params: Record<string, unknown> = {},
  outcome: "success" | "failure" = "success"
) {
  return recordTrainingSample(input || actionValue, actionValue, params, outcome);
}

/**
 * Returns formatted training dataset for SLM fine-tuning.
 */
export async function getTrainingDataset(limit?: number) {
  return storeGetTrainingDataset(limit);
}

/**
 * Ranks next-action suggestions using local model state and recent events.
 */
export async function getPredictionState() {
  const store = getDefaultStore();
  const events = store.getRecentBehaviorEvents(500);

  if (events.length < 3) {
    return { sampleCount: events.length, suggestions: [] as string[] };
  }

  const latestAction = events.at(-1)?.action;
  const previousAction = latestAction && isBehaviorAction(latestAction) ? latestAction : null;
  const model = store.getLocalModel();
  const ranked = rankLocalPredictions(model, contextForNow(previousAction));

  const suggestions = ranked
    .filter((item) => item.score >= 0.14 && ACTION_COMMANDS[item.action])
    .slice(0, 2)
    .map((item) => ACTION_COMMANDS[item.action] as string);

  return { sampleCount: events.length, suggestions };
}

/**
 * Purges all behavioral events and local model weights.
 * Contacts and memories are preserved.
 */
export async function clearBehaviorData(): Promise<void> {
  return storeClearBehaviorData();
}

/**
 * Backward-compatible alias for clearBehaviorData.
 */
export async function clearBehavior(): Promise<void> {
  return clearBehaviorData();
}
