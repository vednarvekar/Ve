# LLD: Local Data Store & Persistence Schema

> **Implementation status:** This is a proposed schema/design document. The app currently uses SQLite, but it is not encrypted. Automatic behavior-sample collection from normal commands is disabled pending explicit opt-in and data controls. Existing samples from earlier builds may remain in a user's database.

## 1. Overview & Storage Strategy

This document proposes a local embedded relational schema. The current implementation uses Node's built-in `node:sqlite` in the application data directory; it does not establish database encryption. Treat the schema and controls below as design targets until checked against the implementation and roadmap.

### Key Rules
- **Rule 1 (Zero Cloud Sync by Default)**: The database is strictly isolated to the host file system.
- **Rule 2 (Sanitization)**: Sensitive parameters (e.g. passwords, message content, private queries) are strictly stripped before logging to behavioral history.
- **Rule 3 (User Control)**: Every table supports user inspection, full JSON export, and single-click zero-fill deletion.

---

## 2. Relational Schema (SQLite DDL)

```sql
-- 1. User preferences & privacy toggles
CREATE TABLE preferences (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 2. Explicit User Contacts
CREATE TABLE contacts (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL COLLATE NOCASE,
    phone_e164 TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- 3. Explicit User Notes & Long-term Memories
CREATE TABLE memories (
    id TEXT PRIMARY KEY NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

-- 4. Behavior Event Log (Anonymized & Sanitized for Local Training)
CREATE TABLE behavior_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_key TEXT NOT NULL,           -- e.g., "app.launch:vscode", "web.search:general"
    time_band INTEGER NOT NULL,         -- 0 = Night (00-06), 1 = Morning (06-12), 2 = Afternoon (12-18), 3 = Evening (18-24)
    day_of_week INTEGER NOT NULL,       -- 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    previous_action_key TEXT,           -- Preceding action identifier or NULL
    execution_outcome TEXT NOT NULL,    -- "success" | "cancelled" | "failed"
    duration_ms INTEGER,
    created_at INTEGER NOT NULL
);

-- Index for temporal queries and habit prediction
CREATE INDEX idx_behavior_context ON behavior_events (day_of_week, time_band, previous_action_key);

-- 5. Local Model & Adapter Weights
CREATE TABLE local_model_state (
    layer_name TEXT PRIMARY KEY NOT NULL,
    weights_blob BLOB NOT NULL,         -- Serialized Float32Array
    shape_json TEXT NOT NULL,           -- Tensor dimensions e.g., "[12, 28]"
    updated_at INTEGER NOT NULL
);
```

---

## 3. Privacy Sanitizer Filter Implementation

Before any executed action is persisted to `behavior_events`, it must pass through the `PrivacySanitizer`:

```typescript
export class PrivacySanitizer {
  private static BLOCKED_KEYS = new Set([
    "password", "token", "apiKey", "auth", "secret", "body", "messageBody", "query"
  ]);

  public static sanitizeAction(intent: string, rawParams: Record<string, unknown>): string {
    switch (intent) {
      case "app.launch":
        // Keep only application identifier (e.g. "vscode", "chrome")
        return `open_app:${String(rawParams.appIdentifier || "unknown")}`;

      case "web.navigate":
        // Extract top-level domain only, strip path, query params, and fragments
        try {
          const url = new URL(String(rawParams.url));
          return `open_url:${url.hostname}`;
        } catch {
          return "open_url:invalid";
        }

      case "web.search":
        // Do NOT log search query text; log intent category only
        return "web_search";

      case "comm.message":
        // Do NOT log message text or phone number; log channel only
        return "comm_message";

      default:
        return intent;
    }
  }
}
```

---

## 4. Retention & Deletion Policy

- **Max Event Cap**: `behavior_events` is capped at a rolling buffer of 1,000 events. Old events are pruned via FIFO.
- **Purge Command**: Invoking `clearLocalBehaviorData()` executes:
  ```sql
  DELETE FROM behavior_events;
  DELETE FROM local_model_state;
  VACUUM;
  ```
- **User Contacts & Memories**: Kept independently from behavioral events; clearing behavioral history does not delete saved contacts or notes.
