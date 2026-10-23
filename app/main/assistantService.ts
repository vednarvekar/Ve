import { app } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  contextForNow,
  isBehaviorAction,
  isLocalModel,
  newLocalModel,
  rankLocalPredictions,
  trainLocalModel,
} from "../core/prediction/localPredictor.js";
import type { BehaviorAction, BehaviorEvent, LocalModel } from "../core/prediction/localPredictor.js";

type Memory = { id: string; text: string; createdAt: number };
export type Contact = { id: string; name: string; phone: string };
type BehaviorData = { events: BehaviorEvent[]; model: LocalModel };
type Store = { memories: Memory[]; contacts: Contact[]; behavior: BehaviorData };

const EMPTY_BEHAVIOR: BehaviorData = { events: [], model: newLocalModel() };
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

async function storePath() {
  const dir = app.getPath("userData");
  await mkdir(dir, { recursive: true });
  return path.join(dir, "ve-data.json");
}

async function readStore(): Promise<Store> {
  try {
    const raw = await readFile(await storePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<Store>;
    const storedBehavior = parsed.behavior as Partial<BehaviorData> | undefined;
    const validEvents = Array.isArray(storedBehavior?.events)
      ? storedBehavior.events.filter((event): event is BehaviorEvent =>
        Boolean(event && isBehaviorAction(event.action) && Number.isInteger(event.timeBand) && event.timeBand >= 0 && event.timeBand <= 3
          && Number.isInteger(event.weekday) && event.weekday >= 0 && event.weekday <= 6
          && (event.previousAction === null || isBehaviorAction(event.previousAction)))
      ).slice(-500)
      : [];
    return {
      memories: Array.isArray(parsed.memories) ? parsed.memories : [],
      contacts: Array.isArray(parsed.contacts) ? parsed.contacts : [],
      behavior: {
        events: validEvents,
        model: isLocalModel(storedBehavior?.model) ? storedBehavior.model : newLocalModel(),
      },
    };
  } catch {
    return { memories: [], contacts: [], behavior: { ...EMPTY_BEHAVIOR, model: newLocalModel() } };
  }
}

async function writeStore(store: Store) {
  await writeFile(await storePath(), JSON.stringify(store, null, 2), { mode: 0o600 });
}

export async function listMemories() {
  return (await readStore()).memories.sort((a, b) => b.createdAt - a.createdAt);
}

export async function addMemory(text: string) {
  const clean = String(text ?? "").trim().slice(0, 4000);
  if (!clean) throw new Error("Memory cannot be empty.");
  const store = await readStore();
  const memory = { id: randomUUID(), text: clean, createdAt: Date.now() };
  store.memories.unshift(memory);
  await writeStore(store);
  return memory;
}

export async function deleteMemory(id: string) {
  const store = await readStore();
  store.memories = store.memories.filter((item) => item.id !== id);
  await writeStore(store);
}

export async function listContacts() {
  return (await readStore()).contacts.sort((a, b) => a.name.localeCompare(b.name));
}

export async function addContact(name: string, phone: string): Promise<Contact> {
  const cleanName = String(name ?? "").trim().slice(0, 80);
  const cleanPhone = String(phone ?? "").replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (!cleanName || cleanPhone.length < 7 || cleanPhone.length > 15 || !/^\d+$/.test(cleanPhone)) {
    throw new Error("Enter a contact name and phone number with country code (7–15 digits).");
  }
  const store = await readStore();
  const contact = { id: randomUUID(), name: cleanName, phone: cleanPhone };
  store.contacts.push(contact);
  await writeStore(store);
  return contact;
}

export async function deleteContact(id: string) {
  const store = await readStore();
  store.contacts = store.contacts.filter((contact) => contact.id !== id);
  await writeStore(store);
}

export async function recordBehavior(actionValue: string) {
  if (!isBehaviorAction(actionValue)) return;
  const action: BehaviorAction = actionValue;
  const store = await readStore();
  const previousAction = store.behavior.events.at(-1)?.action ?? null;
  const context = contextForNow(previousAction);
  const event: BehaviorEvent = { ...context, action };
  store.behavior.events.push(event);
  if (store.behavior.events.length > 500) store.behavior.events.splice(0, store.behavior.events.length - 500);
  store.behavior.model = trainLocalModel(store.behavior.model, context, action);
  await writeStore(store);
}

export async function getPredictionState() {
  const behavior = (await readStore()).behavior;
  if (behavior.events.length < 3) return { sampleCount: behavior.events.length, suggestions: [] as string[] };
  const previousAction = behavior.events.at(-1)?.action ?? null;
  const ranked = rankLocalPredictions(behavior.model, contextForNow(previousAction));
  const suggestions = ranked
    .filter((item) => item.score >= 0.14 && ACTION_COMMANDS[item.action])
    .slice(0, 2)
    .map((item) => ACTION_COMMANDS[item.action] as string);
  return { sampleCount: behavior.events.length, suggestions };
}

export async function clearBehavior() {
  const store = await readStore();
  store.behavior = { events: [], model: newLocalModel() };
  await writeStore(store);
}


