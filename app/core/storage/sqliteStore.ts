import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { PrivacySanitizer } from "./privacySanitizer.js";
import {
  isBehaviorAction,
  isLocalModel,
  newLocalModel,
  trainLocalModel,
  type BehaviorAction,
  type LocalModel,
  type PredictionContext,
  type TimeBand,
} from "../prediction/localPredictor.js";

export interface Contact {
  id: string;
  name: string;
  phone: string;
  createdAt?: number;
}

export interface Memory {
  id: string;
  text: string;
  createdAt?: number;
}

export interface TrainingSample {
  id: string;
  inputText: string;
  canonicalAction: string;
  paramsJson: string;
  timeBand: number;
  dayOfWeek: number;
  outcome: "success" | "failure" | string;
  durationMs: number;
  createdAt: number;
}

export interface TrainingDatasetItem {
  input: string;
  target: string;
  context: {
    timeBand: number;
    weekday: number;
  };
}

/**
 * Resolves the persistent application data directory.
 * Safely works in Electron main process, tests, and headless environments.
 */
export function getStorageDirectory(customDir?: string): string {
  if (customDir) return customDir;
  if (process.env.VE_STORAGE_DIR) return process.env.VE_STORAGE_DIR;

  // 1. Electron environment
  if (process.versions?.electron) {
    try {
      const req = createRequire(import.meta.url);
      const electron = req("electron");
      const app = electron?.app || electron?.default?.app;
      if (app && typeof app.getPath === "function") {
        return app.getPath("userData");
      }
    } catch {
      // Fallback if electron module isn't accessible
    }
  }

  // 2. Test directory override
  if (process.env.TEST_USER_DATA_DIR) {
    return process.env.TEST_USER_DATA_DIR;
  }

  // 3. Fallback for non-Electron / node environments
  const home = process.env.HOME || process.env.USERPROFILE || process.cwd();
  return path.join(home, ".ve");
}

/**
 * Resolves the full path to ve-storage.db.
 */
export function getDatabasePath(customPathOrDir?: string): string {
  if (customPathOrDir) {
    if (customPathOrDir === ":memory:" || customPathOrDir.endsWith(".db") || customPathOrDir.endsWith(".sqlite")) {
      return customPathOrDir;
    }
    return path.join(customPathOrDir, "ve-storage.db");
  }

  if (process.env.VE_STORAGE_PATH) {
    return process.env.VE_STORAGE_PATH;
  }

  const dir = getStorageDirectory();
  return path.join(dir, "ve-storage.db");
}

export class VeStorage {
  private db: DatabaseSync;
  private dbPath: string;

  constructor(targetPath?: string) {
    this.dbPath = getDatabasePath(targetPath);

    if (this.dbPath !== ":memory:") {
      const parentDir = path.dirname(this.dbPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
    }

    this.db = new DatabaseSync(this.dbPath);
    this.initialize();
  }

  private initialize(): void {
    // Enable WAL mode and foreign key constraints for maximum concurrent speed and durability
    try {
      this.db.exec("PRAGMA journal_mode = WAL;");
      this.db.exec("PRAGMA foreign_keys = ON;");
      this.db.exec("PRAGMA synchronous = NORMAL;");
    } catch {
      // Memory or restricted environments might ignore some pragmas
    }

    // 1. Preferences table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS preferences (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // 2. Contacts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL COLLATE NOCASE,
        phone TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    // 3. Memories table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY NOT NULL,
        text TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    // 4. Training samples table (clean, structured training dataset for fine-tuning)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS training_samples (
        id TEXT PRIMARY KEY NOT NULL,
        input_text TEXT NOT NULL,
        canonical_action TEXT NOT NULL,
        params_json TEXT NOT NULL,
        time_band INTEGER NOT NULL,
        day_of_week INTEGER NOT NULL,
        outcome TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_training_context ON training_samples (day_of_week, time_band, canonical_action);
    `);

    // 5. Behavior events table (temporal event log for local predictor)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS behavior_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_key TEXT NOT NULL,
        time_band INTEGER NOT NULL,
        day_of_week INTEGER NOT NULL,
        previous_action_key TEXT,
        execution_outcome TEXT NOT NULL,
        duration_ms INTEGER,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_behavior_context ON behavior_events (day_of_week, time_band, previous_action_key);
    `);

    // 6. Local model state table (serialized LoRA/linear weights)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS local_model_state (
        layer_name TEXT PRIMARY KEY NOT NULL,
        weights_blob BLOB NOT NULL,
        shape_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Run automatic migration from legacy ve-data.json if it exists
    this.migrateFromLegacyJsonIfPresent();
  }

  /**
   * Automatically migrates legacy ve-data.json into SQLite if present.
   */
  private migrateFromLegacyJsonIfPresent(): void {
    if (this.dbPath === ":memory:") return;

    const baseDir = path.dirname(this.dbPath);
    const legacyPath = path.join(baseDir, "ve-data.json");
    if (!fs.existsSync(legacyPath)) return;

    const migrationDone = this.getPreference("migration:ve-data.json");
    if (migrationDone === "completed") return;

    try {
      const raw = fs.readFileSync(legacyPath, "utf-8");
      const parsed = JSON.parse(raw);

      // Migrate contacts
      if (Array.isArray(parsed.contacts)) {
        const insertContact = this.db.prepare(
          "INSERT OR IGNORE INTO contacts (id, name, phone, created_at) VALUES (?, ?, ?, ?)"
        );
        for (const c of parsed.contacts) {
          if (!c || typeof c.name !== "string" || typeof c.phone !== "string") continue;
          insertContact.run(
            c.id || randomUUID(),
            c.name.trim(),
            c.phone.trim(),
            typeof c.createdAt === "number" ? c.createdAt : Date.now()
          );
        }
      }

      // Migrate memories
      if (Array.isArray(parsed.memories)) {
        const insertMemory = this.db.prepare(
          "INSERT OR IGNORE INTO memories (id, text, created_at) VALUES (?, ?, ?)"
        );
        for (const m of parsed.memories) {
          const content = String(m?.text || m?.content || "").trim();
          if (!content) continue;
          insertMemory.run(
            m.id || randomUUID(),
            content,
            typeof m.createdAt === "number" ? m.createdAt : Date.now()
          );
        }
      }

      // Migrate behavior events & model
      if (parsed.behavior) {
        if (Array.isArray(parsed.behavior.events)) {
          const insertSample = this.db.prepare(
            `INSERT INTO training_samples (id, input_text, canonical_action, params_json, time_band, day_of_week, outcome, duration_ms, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          );
          const insertEvent = this.db.prepare(
            `INSERT INTO behavior_events (action_key, time_band, day_of_week, previous_action_key, execution_outcome, duration_ms, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          );

          for (const ev of parsed.behavior.events) {
            if (!ev || !ev.action) continue;
            const timeBand = Number.isInteger(ev.timeBand) ? ev.timeBand : 0;
            const weekday = Number.isInteger(ev.weekday) ? ev.weekday : 0;
            const action = String(ev.action);
            const prev = ev.previousAction ? String(ev.previousAction) : null;
            const now = Date.now();

            insertSample.run(
              randomUUID(),
              "",
              action,
              "{}",
              timeBand,
              weekday,
              "success",
              0,
              now
            );
            insertEvent.run(
              action,
              timeBand,
              weekday,
              prev,
              "success",
              0,
              now
            );
          }
        }

        if (isLocalModel(parsed.behavior.model)) {
          this.saveLocalModel(parsed.behavior.model);
        }
      }

      this.setPreference("migration:ve-data.json", "completed");

      // Safely preserve old file as ve-data.json.migrated
      try {
        fs.renameSync(legacyPath, path.join(baseDir, "ve-data.json.migrated"));
      } catch {
        // If rename fails, preference marker ensures it is not migrated again
      }
    } catch (err) {
      console.warn("Ve could not complete migration from ve-data.json:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // Preferences
  // ---------------------------------------------------------------------------

  public getPreference(key: string): string | null {
    const row = this.db.prepare("SELECT value FROM preferences WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row ? row.value : null;
  }

  public setPreference(key: string, value: string): void {
    this.db
      .prepare(
        "INSERT OR REPLACE INTO preferences (key, value, updated_at) VALUES (?, ?, ?)"
      )
      .run(key, value, Date.now());
  }

  public deletePreference(key: string): void {
    this.db.prepare("DELETE FROM preferences WHERE key = ?").run(key);
  }

  public listPreferences(): Record<string, string> {
    const rows = this.db.prepare("SELECT key, value FROM preferences").all() as Array<{
      key: string;
      value: string;
    }>;
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Contacts CRUD
  // ---------------------------------------------------------------------------

  public listContacts(): Contact[] {
    const rows = this.db
      .prepare("SELECT id, name, phone, created_at AS createdAt FROM contacts ORDER BY name COLLATE NOCASE ASC")
      .all() as Array<{ id: string; name: string; phone: string; createdAt: number }>;
    return rows;
  }

  public getContact(id: string): Contact | null {
    const row = this.db
      .prepare("SELECT id, name, phone, created_at AS createdAt FROM contacts WHERE id = ?")
      .get(id) as { id: string; name: string; phone: string; createdAt: number } | undefined;
    return row ?? null;
  }

  public addContact(name: string, phone: string): Contact {
    const cleanName = String(name ?? "").trim().slice(0, 80);
    const cleanPhone = String(phone ?? "").replace(/[^\d+]/g, "").replace(/^\+/, "");
    if (!cleanName || cleanPhone.length < 7 || cleanPhone.length > 15 || !/^\d+$/.test(cleanPhone)) {
      throw new Error("Enter a contact name and phone number with country code (7–15 digits).");
    }

    const contact: Contact = {
      id: randomUUID(),
      name: cleanName,
      phone: cleanPhone,
      createdAt: Date.now(),
    };

    this.db
      .prepare("INSERT INTO contacts (id, name, phone, created_at) VALUES (?, ?, ?, ?)")
      .run(contact.id, contact.name, contact.phone, contact.createdAt ?? Date.now());

    return contact;
  }

  public updateContact(id: string, name: string, phone: string): Contact {
    const cleanName = String(name ?? "").trim().slice(0, 80);
    const cleanPhone = String(phone ?? "").replace(/[^\d+]/g, "").replace(/^\+/, "");
    if (!cleanName || cleanPhone.length < 7 || cleanPhone.length > 15 || !/^\d+$/.test(cleanPhone)) {
      throw new Error("Enter a contact name and phone number with country code (7–15 digits).");
    }

    const result = this.db
      .prepare("UPDATE contacts SET name = ?, phone = ? WHERE id = ?")
      .run(cleanName, cleanPhone, id);

    if (result.changes === 0) {
      throw new Error(`Contact with id ${id} not found.`);
    }

    const existing = this.getContact(id);
    return existing!;
  }

  public deleteContact(id: string): void {
    this.db.prepare("DELETE FROM contacts WHERE id = ?").run(id);
  }

  // ---------------------------------------------------------------------------
  // Memories CRUD
  // ---------------------------------------------------------------------------

  public listMemories(): Memory[] {
    const rows = this.db
      .prepare("SELECT id, text, created_at AS createdAt FROM memories ORDER BY created_at DESC, rowid DESC")
      .all() as Array<{ id: string; text: string; createdAt: number }>;
    return rows;
  }

  public getMemory(id: string): Memory | null {
    const row = this.db
      .prepare("SELECT id, text, created_at AS createdAt FROM memories WHERE id = ?")
      .get(id) as { id: string; text: string; createdAt: number } | undefined;
    return row ?? null;
  }

  public addMemory(text: string): Memory {
    const clean = String(text ?? "").trim().slice(0, 4000);
    if (!clean) throw new Error("Memory cannot be empty.");

    const memory: Memory = {
      id: randomUUID(),
      text: clean,
      createdAt: Date.now(),
    };

    this.db
      .prepare("INSERT INTO memories (id, text, created_at) VALUES (?, ?, ?)")
      .run(memory.id, memory.text, memory.createdAt ?? Date.now());

    return memory;
  }

  public updateMemory(id: string, text: string): Memory {
    const clean = String(text ?? "").trim().slice(0, 4000);
    if (!clean) throw new Error("Memory cannot be empty.");

    const result = this.db
      .prepare("UPDATE memories SET text = ? WHERE id = ?")
      .run(clean, id);

    if (result.changes === 0) {
      throw new Error(`Memory with id ${id} not found.`);
    }

    const updated = this.getMemory(id);
    return updated!;
  }

  public deleteMemory(id: string): void {
    this.db.prepare("DELETE FROM memories WHERE id = ?").run(id);
  }

  // ---------------------------------------------------------------------------
  // Training Samples & Behavior Logging
  // ---------------------------------------------------------------------------

  /**
   * Records a user interaction as a clean, structured training sample.
   * Strips sensitive tokens and passwords before persistence.
   */
  public recordTrainingSample(
    input: string,
    action: string,
    params: Record<string, unknown> = {},
    outcome: "success" | "failure" = "success",
    options?: {
      durationMs?: number;
      timeBand?: number;
      weekday?: number;
      previousAction?: string | null;
      now?: Date;
    }
  ): { id: string; canonicalAction: string } {
    const now = options?.now || new Date();
    const hour = now.getHours();
    const timeBand: TimeBand =
      options?.timeBand !== undefined
        ? (Math.max(0, Math.min(3, options.timeBand)) as TimeBand)
        : hour < 6
        ? 0
        : hour < 12
        ? 1
        : hour < 18
        ? 2
        : 3;
    const weekday = options?.weekday !== undefined ? options.weekday : now.getDay();
    const durationMs = options?.durationMs ?? 0;

    // 1. Privacy Sanitization
    const canonicalAction = PrivacySanitizer.sanitizeAction(action, params);
    const sanitizedParams = PrivacySanitizer.sanitizeParams(params);
    const sanitizedInput = PrivacySanitizer.sanitizeInput(input);

    const id = randomUUID();
    const createdAt = now.getTime();

    // 2. Insert into training_samples
    this.db
      .prepare(
        `INSERT INTO training_samples (id, input_text, canonical_action, params_json, time_band, day_of_week, outcome, duration_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        sanitizedInput,
        canonicalAction,
        JSON.stringify(sanitizedParams),
        timeBand,
        weekday,
        outcome,
        durationMs,
        createdAt
      );

    // 3. Insert into behavior_events (for habit/sequence prediction)
    const prevAction =
      options?.previousAction !== undefined
        ? options.previousAction
        : this.getLatestBehaviorAction();

    this.db
      .prepare(
        `INSERT INTO behavior_events (action_key, time_band, day_of_week, previous_action_key, execution_outcome, duration_ms, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        canonicalAction,
        timeBand,
        weekday,
        prevAction,
        outcome,
        durationMs,
        createdAt
      );

    // Enforce rolling buffer cap of 1,000 behavior events (FIFO prune)
    this.pruneBehaviorEvents(1000);

    // 4. If action is a recognized BehaviorAction and successful, incrementally train local model
    if (outcome === "success" && isBehaviorAction(canonicalAction)) {
      try {
        const model = this.getLocalModel();
        const context: PredictionContext = {
          timeBand,
          weekday,
          previousAction: prevAction && isBehaviorAction(prevAction) ? (prevAction as BehaviorAction) : null,
        };
        const updated = trainLocalModel(model, context, canonicalAction as BehaviorAction);
        this.saveLocalModel(updated);
      } catch (err) {
        console.warn("Ve could not train local model from sample:", err);
      }
    }

    return { id, canonicalAction };
  }

  /**
   * Retrieves dataset of prompt-completion pairs formatted for SLM fine-tuning.
   */
  public getTrainingDataset(
    limit?: number,
    options?: { onlySuccessful?: boolean }
  ): TrainingDatasetItem[] {
    const onlySuccessful = options?.onlySuccessful ?? true;
    const whereClause = onlySuccessful ? "WHERE outcome = 'success'" : "";

    const rows = (
      typeof limit === "number" && limit > 0
        ? this.db
            .prepare(
              `SELECT input_text, canonical_action, time_band, day_of_week
               FROM training_samples
               ${whereClause}
               ORDER BY created_at ASC
               LIMIT ?`
            )
            .all(limit)
        : this.db
            .prepare(
              `SELECT input_text, canonical_action, time_band, day_of_week
               FROM training_samples
               ${whereClause}
               ORDER BY created_at ASC`
            )
            .all()
    ) as Array<{
      input_text: string;
      canonical_action: string;
      time_band: number;
      day_of_week: number;
    }>;

    return rows.map((row) => ({
      input: String(row.input_text),
      target: String(row.canonical_action),
      context: {
        timeBand: Number(row.time_band),
        weekday: Number(row.day_of_week),
      },
    }));
  }

  /**
   * Exports the training dataset in JSONL format.
   */
  public exportTrainingDatasetJsonl(limit?: number): string {
    const dataset = this.getTrainingDataset(limit);
    return dataset.map((item) => JSON.stringify(item)).join("\n");
  }

  /**
   * Returns recent behavior events.
   */
  public getRecentBehaviorEvents(limit = 500): Array<{
    action: string;
    timeBand: number;
    weekday: number;
    previousAction: string | null;
  }> {
    const rows = this.db
      .prepare(
        `SELECT action_key AS action, time_band AS timeBand, day_of_week AS weekday, previous_action_key AS previousAction
         FROM behavior_events
         ORDER BY id DESC
         LIMIT ?`
      )
      .all(limit) as Array<{
      action: string;
      timeBand: number;
      weekday: number;
      previousAction: string | null;
    }>;

    return rows.reverse();
  }

  public getLatestBehaviorAction(): string | null {
    const row = this.db
      .prepare("SELECT action_key FROM behavior_events ORDER BY id DESC LIMIT 1")
      .get() as { action_key: string } | undefined;
    return row ? row.action_key : null;
  }

  private pruneBehaviorEvents(maxCount: number): void {
    const countRow = this.db.prepare("SELECT COUNT(*) as count FROM behavior_events").get() as {
      count: number;
    };
    if (countRow.count > maxCount) {
      const excess = countRow.count - maxCount;
      this.db
        .prepare(
          "DELETE FROM behavior_events WHERE id IN (SELECT id FROM behavior_events ORDER BY id ASC LIMIT ?)"
        )
        .run(excess);
    }
  }

  // ---------------------------------------------------------------------------
  // Local Model State Persistence (Float32Array BLOB)
  // ---------------------------------------------------------------------------

  public getLocalModel(layerName = "output"): LocalModel {
    const row = this.db
      .prepare("SELECT weights_blob, shape_json FROM local_model_state WHERE layer_name = ?")
      .get(layerName) as { weights_blob: Uint8Array; shape_json: string } | undefined;

    if (!row || !row.weights_blob || !row.shape_json) {
      return newLocalModel();
    }

    try {
      const [rows, cols] = JSON.parse(row.shape_json) as [number, number];
      const buffer = row.weights_blob;
      const floatView = new Float32Array(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength / Float32Array.BYTES_PER_ELEMENT
      );

      const weights: number[][] = [];
      for (let r = 0; r < rows; r++) {
        weights.push(Array.from(floatView.subarray(r * cols, (r + 1) * cols)));
      }

      const model = { version: 1 as const, weights };
      return isLocalModel(model) ? model : newLocalModel();
    } catch {
      return newLocalModel();
    }
  }

  public saveLocalModel(model: LocalModel, layerName = "output"): void {
    if (!isLocalModel(model)) return;

    const rows = model.weights.length;
    const cols = model.weights[0]?.length ?? 0;
    const flat = new Float32Array(rows * cols);

    let idx = 0;
    for (const row of model.weights) {
      for (const val of row) {
        flat[idx++] = val;
      }
    }

    const blob = Buffer.from(flat.buffer, flat.byteOffset, flat.byteLength);
    const shapeJson = JSON.stringify([rows, cols]);

    this.db
      .prepare(
        "INSERT OR REPLACE INTO local_model_state (layer_name, weights_blob, shape_json, updated_at) VALUES (?, ?, ?, ?)"
      )
      .run(layerName, blob, shapeJson, Date.now());
  }

  // ---------------------------------------------------------------------------
  // Purge & Zero-Fill
  // ---------------------------------------------------------------------------

  /**
   * Clears behavioral events, training samples, and local model state.
   * Contacts and persistent memories are safely preserved.
   */
  public clearBehaviorData(): void {
    this.db.exec(`
      DELETE FROM training_samples;
      DELETE FROM behavior_events;
      DELETE FROM local_model_state;
      VACUUM;
    `);
  }

  /**
   * Full data export for user inspection / governance.
   */
  public exportToJson(): {
    preferences: Record<string, string>;
    contacts: Contact[];
    memories: Memory[];
    trainingSamplesCount: number;
    behaviorEventsCount: number;
    modelLayers: string[];
  } {
    const preferences = this.listPreferences();
    const contacts = this.listContacts();
    const memories = this.listMemories();

    const trainingCount = (
      this.db.prepare("SELECT COUNT(*) as c FROM training_samples").get() as { c: number }
    ).c;
    const behaviorCount = (
      this.db.prepare("SELECT COUNT(*) as c FROM behavior_events").get() as { c: number }
    ).c;
    const layers = (
      this.db.prepare("SELECT layer_name FROM local_model_state").all() as Array<{
        layer_name: string;
      }>
    ).map((r) => r.layer_name);

    return {
      preferences,
      contacts,
      memories,
      trainingSamplesCount: trainingCount,
      behaviorEventsCount: behaviorCount,
      modelLayers: layers,
    };
  }

  public close(): void {
    try {
      this.db.close();
    } catch {
      // ignore
    }
  }
}

// -----------------------------------------------------------------------------
// Global Default Store Instance & Clean Functional Exports
// -----------------------------------------------------------------------------

let defaultStoreInstance: VeStorage | null = null;

export function getDefaultStore(): VeStorage {
  if (!defaultStoreInstance) {
    defaultStoreInstance = new VeStorage();
  }
  return defaultStoreInstance;
}

export function resetDefaultStore(newStore?: VeStorage): void {
  if (defaultStoreInstance) {
    defaultStoreInstance.close();
  }
  defaultStoreInstance = newStore ?? null;
}

export async function recordTrainingSample(
  input: string,
  action: string,
  params: Record<string, unknown> = {},
  outcome: "success" | "failure" = "success"
) {
  return getDefaultStore().recordTrainingSample(input, action, params, outcome);
}

export async function getTrainingDataset(limit?: number) {
  return getDefaultStore().getTrainingDataset(limit);
}

export async function clearBehaviorData(): Promise<void> {
  getDefaultStore().clearBehaviorData();
}

export async function listContacts(): Promise<Contact[]> {
  return getDefaultStore().listContacts();
}

export async function getContact(id: string): Promise<Contact | null> {
  return getDefaultStore().getContact(id);
}

export async function addContact(name: string, phone: string): Promise<Contact> {
  return getDefaultStore().addContact(name, phone);
}

export async function updateContact(id: string, name: string, phone: string): Promise<Contact> {
  return getDefaultStore().updateContact(id, name, phone);
}

export async function deleteContact(id: string): Promise<void> {
  getDefaultStore().deleteContact(id);
}

export async function listMemories(): Promise<Memory[]> {
  return getDefaultStore().listMemories();
}

export async function getMemory(id: string): Promise<Memory | null> {
  return getDefaultStore().getMemory(id);
}

export async function addMemory(text: string): Promise<Memory> {
  return getDefaultStore().addMemory(text);
}

export async function updateMemory(id: string, text: string): Promise<Memory> {
  return getDefaultStore().updateMemory(id, text);
}

export async function deleteMemory(id: string): Promise<void> {
  getDefaultStore().deleteMemory(id);
}

export async function getPreference(key: string): Promise<string | null> {
  return getDefaultStore().getPreference(key);
}

export async function setPreference(key: string, value: string): Promise<void> {
  getDefaultStore().setPreference(key, value);
}

export async function getLocalModel(): Promise<LocalModel> {
  return getDefaultStore().getLocalModel();
}

export async function saveLocalModel(model: LocalModel): Promise<void> {
  getDefaultStore().saveLocalModel(model);
}
