# Current Implementation Baseline

Audited from the source on 2026-10-24. This describes the checked-in prototype, not the target architecture.

## Development environment and limits

- The current development environment is x86_64 Linux under WSL2, with Windows host integration in the launcher. The repository has Windows, macOS, Linux, and WSL branches, but no release platform has been declared or validated as supported.
- The app is an Electron tray process with a React chat popup. Voice input, local file discovery, browser automation, streaming availability lookup, Spotify control, and dynamic installed-app discovery are not implemented end to end.
- `app/core/slm/assets/model.onnx` is a roughly 22 MB ONNX artifact used by the current intent prototype. It is not a demonstrated generative 10–20M parameter task planner.

## Command path

`app/renderer/components/inputBar.tsx` → `app/renderer/hooks/useChat.ts` → `window.ve.runCommand` in `app/preload/preload.cts` → `ve:run-command` in `app/main/index.ts` → `executeUserInput` in `app/core/intentParser/index.ts` → `defaultSkillRouter` → registered skill.

The local ONNX intent parser runs first; a deterministic phrase parser is the fallback. The currently registered skills are:

- **Open app:** `OpenAppSkill` supports a fixed alias table for Chrome, Firefox, VS Code, Calculator, Notepad, Terminal, and File Explorer. It launches through platform-specific commands. This is not dynamic app discovery; unknown app names fail.
- **Browse/search:** `BrowserSkill` opens HTTP(S) navigation URLs or search URLs in the system browser. Search providers are Google, DuckDuckGo, Bing, YouTube, Netflix, GitHub, Reddit, and Wikipedia; unknown provider names fall back to Google. It does not inspect pages or automate browser workflows.
- **WhatsApp handoff:** `WhatsAppSkill` uses a saved local contact or supplied phone number and opens a `wa.me` URL with the message prefilled. The phone and message are passed to WhatsApp in that external URL; the user must verify and press Send. It does not attach files or send automatically.

The main process currently accepts IPC calls without validating the sender frame or payload. The skill `riskLevel` is metadata, not an enforced policy gate. These are known security gaps tracked in Steps 2.1–2.2.

## Network and external handoffs

There is no direct AI API client or background network fetch in the command path. Actions may still disclose data through the system browser:

- Search sends the requested query to the chosen provider in a URL.
- Navigation opens the user-requested URL in the system browser.
- WhatsApp handoff opens `https://wa.me/<phone>?text=<message>`; WhatsApp receives the recipient number and prefilled message.

App launches use OS process/shell integration and are separate from web requests. Online lookups are therefore not private/offline operations even though intent parsing is local.

## Local data

SQLite uses Electron's `userData` directory in the app, with `~/.ve` as the non-Electron fallback. The database is not encrypted. Its tables and fields are:

| Table | Fields |
|---|---|
| `preferences` | `key`, `value`, `updated_at` |
| `contacts` | `id`, `name`, `phone`, `created_at` |
| `memories` | `id`, `text`, `created_at` |
| `training_samples` | `id`, `input_text`, `canonical_action`, `params_json`, `time_band`, `day_of_week`, `outcome`, `duration_ms`, `created_at` |
| `behavior_events` | `id`, `action_key`, `time_band`, `day_of_week`, `previous_action_key`, `execution_outcome`, `duration_ms`, `created_at` |
| `local_model_state` | `layer_name`, `weights_blob`, `shape_json`, `updated_at` |

The current command handler no longer writes training samples, and suggestions do not use existing samples until opt-in controls exist. Existing databases can still contain samples from older builds; their sanitizer was limited and could leave command text. The app provides an erase behavior action, but no export or retention controls are exposed in the UI. The current chat display itself is held in renderer memory and cleared on startup.

Legacy `ve-data.json` files may be migrated into SQLite and renamed to `ve-data.json.migrated`; migration is a local file operation.
