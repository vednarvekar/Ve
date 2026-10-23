import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  VeStorage,
  getDatabasePath,
  PrivacySanitizer,
  getDefaultStore,
  resetDefaultStore,
} from "../dist/core/storage/index.js";
import {
  newLocalModel,
  rankLocalPredictions,
} from "../dist/core/prediction/localPredictor.js";

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    throw err;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    throw err;
  }
}

console.log("Running Ve SQLite Storage & Dataset Generation tests...\n");

// Helper to create clean temp directory
function createTempDir(prefix = "ve-test-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// ---------------------------------------------------------------------------
// 1. Privacy Sanitizer
// ---------------------------------------------------------------------------
test("PrivacySanitizer strips credentials, query strings, and message contents", () => {
  // Params sanitization
  const rawParams = {
    apiKey: "sk-secret12345",
    password: "super-secret-password",
    authToken: "bearer 9999",
    query: "secret medical inquiry",
    message: "Meeting at 5pm at safehouse",
    url: "https://github.com/vednarvekar/Ve?secret=123#token",
    target: "vscode",
    appIdentifier: "Chrome",
  };

  const cleanParams = PrivacySanitizer.sanitizeParams(rawParams);
  assert.equal(cleanParams.apiKey, undefined, "apiKey must be stripped");
  assert.equal(cleanParams.password, undefined, "password must be stripped");
  assert.equal(cleanParams.authToken, undefined, "authToken must be stripped");
  assert.equal(cleanParams.query, undefined, "query must be stripped");
  assert.equal(cleanParams.message, undefined, "message must be stripped");
  assert.equal(cleanParams.url, "github.com", "URL must be stripped to hostname only");
  assert.equal(cleanParams.target, "vscode");

  // Action sanitization
  assert.equal(
    PrivacySanitizer.sanitizeAction("openApp", { target: "vscode" }),
    "open_app:vscode"
  );
  assert.equal(
    PrivacySanitizer.sanitizeAction("openUrl", { url: "https://netflix.com/browse?trackId=123" }),
    "open_url:netflix.com"
  );
  assert.equal(
    PrivacySanitizer.sanitizeAction("webSearch", { query: "classified query" }),
    "web_search"
  );
  assert.equal(
    PrivacySanitizer.sanitizeAction("whatsApp", { message: "confidential" }),
    "whatsapp_message"
  );

  // Input text sanitization
  const cleanInput = PrivacySanitizer.sanitizeInput("send 'meet at noon' to Alice");
  assert.ok(!cleanInput.includes("meet at noon"), "Private message text must be redacted from input");
  assert.ok(cleanInput.includes("to Alice"), "Recipient should be retained");

  const cleanCredsInput = PrivacySanitizer.sanitizeInput("connect token: xyz98765 now");
  assert.ok(!cleanCredsInput.includes("xyz98765"), "Token value must be redacted from input");
});

// ---------------------------------------------------------------------------
// 2. Database Initialization & Schema Verification
// ---------------------------------------------------------------------------
test("SQLite database initializes tables, indices, and pragmas properly", () => {
  const tempDir = createTempDir("ve-db-init-");
  const dbFile = path.join(tempDir, "ve-storage.db");

  const store = new VeStorage(dbFile);
  assert.ok(fs.existsSync(dbFile), "ve-storage.db file must be created on disk");

  // Verify tables exist
  const tables = store["db"]
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((r) => r.name);

  assert.ok(tables.includes("preferences"), "preferences table must exist");
  assert.ok(tables.includes("contacts"), "contacts table must exist");
  assert.ok(tables.includes("memories"), "memories table must exist");
  assert.ok(tables.includes("training_samples"), "training_samples table must exist");
  assert.ok(tables.includes("behavior_events"), "behavior_events table must exist");
  assert.ok(tables.includes("local_model_state"), "local_model_state table must exist");

  store.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 3. Contacts CRUD Operations
// ---------------------------------------------------------------------------
test("Contacts CRUD operations work with validation and case-insensitive ordering", () => {
  const tempDir = createTempDir("ve-contacts-");
  const store = new VeStorage(path.join(tempDir, "ve-storage.db"));

  // Add contacts
  const c1 = store.addContact("Ved Narvekar", "+91 9876543210");
  const c2 = store.addContact("alice", "1234567890");
  const c3 = store.addContact("Bob", "+1 (555) 000-1111");

  assert.equal(c1.name, "Ved Narvekar");
  assert.equal(c1.phone, "919876543210");
  assert.equal(c2.phone, "1234567890");
  assert.equal(c3.phone, "15550001111");

  // List contacts - alphabetical case-insensitive
  const list = store.listContacts();
  assert.equal(list.length, 3);
  assert.equal(list[0].name, "alice");
  assert.equal(list[1].name, "Bob");
  assert.equal(list[2].name, "Ved Narvekar");

  // Get single contact
  const fetched = store.getContact(c1.id);
  assert.ok(fetched);
  assert.equal(fetched.name, "Ved Narvekar");

  // Update contact
  const updated = store.updateContact(c2.id, "Alice Smith", "1234567890");
  assert.equal(updated.name, "Alice Smith");

  // Delete contact
  store.deleteContact(c3.id);
  assert.equal(store.listContacts().length, 2);

  // Validation errors
  assert.throws(() => store.addContact("", "1234567890"), /Enter a contact name/);
  assert.throws(() => store.addContact("Bad Phone", "123"), /Enter a contact name and phone/);

  store.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 4. Memories CRUD Operations
// ---------------------------------------------------------------------------
test("Memories CRUD operations work with timestamp ordering", () => {
  const tempDir = createTempDir("ve-memories-");
  const store = new VeStorage(path.join(tempDir, "ve-storage.db"));

  const m1 = store.addMemory("Note 1: Favorite editor is VS Code");
  const m2 = store.addMemory("Note 2: Uses dark mode exclusively");

  const list = store.listMemories();
  assert.equal(list.length, 2);
  assert.equal(list[0].text, "Note 2: Uses dark mode exclusively"); // Newest first

  const single = store.getMemory(m1.id);
  assert.ok(single);
  assert.equal(single.text, "Note 1: Favorite editor is VS Code");

  store.updateMemory(m1.id, "Note 1: Favorite editor is Cursor / VS Code");
  assert.equal(store.getMemory(m1.id)?.text, "Note 1: Favorite editor is Cursor / VS Code");

  store.deleteMemory(m2.id);
  assert.equal(store.listMemories().length, 1);

  assert.throws(() => store.addMemory(""), /Memory cannot be empty/);

  store.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 5. Training Samples & Training Dataset Generation
// ---------------------------------------------------------------------------
test("recordTrainingSample sanitizes data and getTrainingDataset generates clean dataset", () => {
  const tempDir = createTempDir("ve-training-");
  const store = new VeStorage(path.join(tempDir, "ve-storage.db"));

  // Record samples with sensitive fields
  store.recordTrainingSample(
    "open chrome",
    "openApp",
    { target: "chrome", password: "secret_should_be_stripped" },
    "success",
    { timeBand: 1, weekday: 2 }
  );

  store.recordTrainingSample(
    "search lofi beats on youtube",
    "webSearch",
    { query: "lofi beats", auth: "token_should_be_stripped" },
    "success",
    { timeBand: 2, weekday: 3 }
  );

  store.recordTrainingSample(
    "invalid command with bad syntax",
    "unknown",
    {},
    "failure",
    { timeBand: 0, weekday: 1 }
  );

  // Retrieve dataset (verified / successful actions)
  const dataset = store.getTrainingDataset();
  assert.equal(dataset.length, 2, "Dataset should contain the 2 successful training samples");

  assert.equal(dataset[0].input, "open chrome");
  assert.equal(dataset[0].target, "open_app:chrome");
  assert.equal(dataset[0].context.timeBand, 1);
  assert.equal(dataset[0].context.weekday, 2);

  assert.equal(dataset[1].input, "search lofi beats on youtube");
  assert.equal(dataset[1].target, "web_search");
  assert.equal(dataset[1].context.timeBand, 2);
  assert.equal(dataset[1].context.weekday, 3);

  // Test JSONL export format
  const jsonl = store.exportTrainingDatasetJsonl();
  const lines = jsonl.trim().split("\n");
  assert.equal(lines.length, 2);
  const parsedFirst = JSON.parse(lines[0]);
  assert.equal(parsedFirst.target, "open_app:chrome");

  // Verify parameters stored in SQLite database have zero credentials
  const rawRows = store["db"].prepare("SELECT params_json FROM training_samples").all();
  for (const row of rawRows) {
    assert.ok(!row.params_json.includes("secret_should_be_stripped"));
    assert.ok(!row.params_json.includes("token_should_be_stripped"));
  }

  store.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 6. Local Model State Persistence (Float32Array BLOB)
// ---------------------------------------------------------------------------
test("Local model state serializes and deserializes Float32Array weights correctly", () => {
  const tempDir = createTempDir("ve-model-");
  const store = new VeStorage(path.join(tempDir, "ve-storage.db"));

  const model = newLocalModel();
  model.weights[0][0] = 3.14159;
  model.weights[1][5] = 0.4242;

  store.saveLocalModel(model);

  const restored = store.getLocalModel();
  assert.equal(restored.version, 1);
  assert.equal(restored.weights.length, model.weights.length);
  assert.ok(Math.abs(restored.weights[0][0] - 3.14159) < 1e-4);
  assert.ok(Math.abs(restored.weights[1][5] - 0.4242) < 1e-4);

  // Model can make predictions
  const predictions = rankLocalPredictions(restored, {
    timeBand: 1,
    weekday: 2,
    previousAction: null,
  });
  assert.ok(Array.isArray(predictions));
  assert.ok(predictions.length > 0);

  store.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 7. Data Purge (Clear Behavior Data)
// ---------------------------------------------------------------------------
test("clearBehaviorData removes training samples and models but preserves contacts & memories", () => {
  const tempDir = createTempDir("ve-purge-");
  const store = new VeStorage(path.join(tempDir, "ve-storage.db"));

  // Add contacts and memories
  const contact = store.addContact("Keep Me", "1234567890");
  const memory = store.addMemory("Keep this note safe");

  // Add training sample & model
  store.recordTrainingSample("open vs code", "openApp", { target: "vscode" }, "success");
  const model = newLocalModel();
  model.weights[0][0] = 99.9;
  store.saveLocalModel(model);

  assert.equal(store.getTrainingDataset().length, 1);
  assert.ok(store.getLocalModel().weights[0][0] > 90);

  // Purge behavior history
  store.clearBehaviorData();

  // Behavior & training samples are purged
  assert.equal(store.getTrainingDataset().length, 0);
  assert.equal(store.getLocalModel().weights[0][0], 0, "Model weights must be reset to initial blank state");

  // Contacts and memories remain intact!
  assert.equal(store.listContacts().length, 1);
  assert.equal(store.listContacts()[0].name, "Keep Me");
  assert.equal(store.listMemories().length, 1);
  assert.equal(store.listMemories()[0].text, "Keep this note safe");

  store.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 8. Automatic Migration from legacy ve-data.json
// ---------------------------------------------------------------------------
test("Automatic migration from legacy ve-data.json imports contacts, memories, events, and model", () => {
  const tempDir = createTempDir("ve-migration-");

  // Prepare legacy ve-data.json
  const legacyData = {
    memories: [
      { id: "mem-1", text: "Legacy memory from json", createdAt: 1000 },
    ],
    contacts: [
      { id: "c-1", name: "Legacy Contact", phone: "9876543210" },
    ],
    behavior: {
      events: [
        {
          timeBand: 1,
          weekday: 2,
          previousAction: null,
          action: "open_app:chrome",
        },
      ],
      model: {
        version: 1,
        weights: newLocalModel().weights,
      },
    },
  };
  legacyData.behavior.model.weights[0][0] = 7.77;

  const legacyFilePath = path.join(tempDir, "ve-data.json");
  fs.writeFileSync(legacyFilePath, JSON.stringify(legacyData, null, 2), "utf-8");

  // Instantiate VeStorage on the directory containing ve-data.json
  const store = new VeStorage(path.join(tempDir, "ve-storage.db"));

  // Verify contacts were migrated
  const contacts = store.listContacts();
  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].name, "Legacy Contact");

  // Verify memories were migrated
  const memories = store.listMemories();
  assert.equal(memories.length, 1);
  assert.equal(memories[0].text, "Legacy memory from json");

  // Verify behavior samples were migrated
  const dataset = store.getTrainingDataset();
  assert.equal(dataset.length, 1);
  assert.equal(dataset[0].target, "open_app:chrome");

  // Verify model weights were migrated
  const restoredModel = store.getLocalModel();
  assert.ok(Math.abs(restoredModel.weights[0][0] - 7.77) < 1e-4);

  // Verify migration flag is marked
  assert.equal(store.getPreference("migration:ve-data.json"), "completed");

  // Verify legacy file is preserved as ve-data.json.migrated
  assert.ok(!fs.existsSync(legacyFilePath));
  assert.ok(fs.existsSync(path.join(tempDir, "ve-data.json.migrated")));

  store.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// 9. Global Default Store and Safe Path Resolution
// ---------------------------------------------------------------------------
test("Safe fallback for non-Electron test environments works without throwing", () => {
  const tempDir = createTempDir("ve-fallback-");
  process.env.TEST_USER_DATA_DIR = tempDir;

  const resolvedDbPath = getDatabasePath();
  assert.ok(resolvedDbPath.includes(tempDir));
  assert.ok(resolvedDbPath.endsWith("ve-storage.db"));

  delete process.env.TEST_USER_DATA_DIR;
  fs.rmSync(tempDir, { recursive: true, force: true });
});

console.log("\nALL STORAGE TESTS PASSED SUCCESSFULLY!");
