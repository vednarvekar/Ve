# Ve — Architecture Document

## 1. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Shell / Tray UI | **Electron** (Node.js/TS main process + React/TS renderer) | `Tray` + a frameless `BrowserWindow` positioned near the system tray gives the wifi-flyout-style popup. Main process is the Node/TS backend; renderer is the frontend — one language, one runtime, no Rust involved |
| Frontend framework | React + TypeScript | Chat UI, message history state, mic/text input handling |
| Speech-to-text | whisper.cpp, invoked via a Node binding (`whisper-node` / `nodejs-whisper`) or as a child process calling the whisper.cpp CLI | Local, offline, CPU-friendly; Node just orchestrates the underlying binary |
| Intent parsing | Cloud LLM API (prototype, called via TS `fetch` from the main process) → local model via Ollama for privacy release | Ollama exposes a local HTTP API, so swapping cloud → local is just changing the endpoint, no language/runtime change |
| Browser automation | Playwright (`playwright` npm package) | First-class TS API, same language as the rest of the app |
| Native app automation | Windows UI Automation via a Node native addon (`node-ffi-napi` + UIA COM interop) or a small child-process helper | Only for specific high-value, hand-maintained integrations; treated as fragile/expensive per-app. See note below — this is the one layer JS/TS can't fully own. |
| Local storage | SQLite via `better-sqlite3` | Preferences, command history, logs for prediction model. Sync API, fast, TS-friendly |
| Prediction model (v3) | Training: Python (scikit-learn/lightgbm), offline/one-off script only, exported to ONNX. Inference: `onnxruntime-node` loads the `.onnx` model directly inside the Electron main process | Python never runs inside the shipped app — it's a build-time tool used once to produce the model file; the running app stays pure Node/TS |
| Packaging | `electron-builder` | Produces the installable Windows app |

**Note on the one non-JS exception**: Windows UI Automation and whisper.cpp are C/C++ under the hood — that's an OS/ML-library constraint, not a language choice you're making. You consume them through Node bindings or child processes; you never *write* C#, Rust, or C++ yourself. All app logic — UI, routing, skills, storage — stays JS/TS end to end.

## 2. High-Level App Flow

```
[System boots]
      │
      ▼
Tray icon process starts (background, minimal footprint)
      │
      ▼
User clicks tray icon
      │
      ▼
Popup window opens (chat UI: text bar + mic icon + message history)
      │
      ├── User types text ──────────────┐
      │                                  │
      └── User clicks mic → speaks ──────┤
                                          ▼
                              Speech-to-text (if voice) → raw text
                                          │
                                          ▼
                              Intent Parser (LLM: cloud or local)
                                          │
                                          ▼
                         Structured command: { skill, params }
                                          │
                                          ▼
                                   Skill Router
                                          │
                     ┌────────────────────┼─────────────────────┐
                     ▼                    ▼                      ▼
              App Launcher          URL / Web Search        Browser Automation
              (shell exec)          (open default/           (Playwright: search +
                                     preferred browser)        open content)
                     │                    │                      │
                     └────────────────────┴──────────────────────┘
                                          ▼
                              Result shown in chat window
                          (success confirmation OR failure + fallback)
                                          │
                                          ▼
                         Action logged locally (SQLite) — for
                         preference learning + prediction model (v3)
```

### Startup suggestion flow (v3, separate trigger path)
```
[System boots] → Prediction model checks time/day/context →
if confidence > threshold → tray shows lightweight suggestion popup
→ user clicks (accept) or dismisses (ignored, logged as negative signal)
```

## 3. Proposed File Structure

```
Ve/
├── src/
│   ├── main/                     # Electron main process (Node/TS backend)
│   │   ├── tray.ts               # Tray icon setup + click handling
│   │   ├── popupWindow.ts        # BrowserWindow creation/positioning
│   │   ├── ipc/                  # IPC handlers between renderer and main
│   │   │   └── handlers.ts
│   │   └── index.ts              # Electron app entrypoint
│   │
│   ├── renderer/                 # Frontend (React + TS, runs in the popup window)
│   │   ├── components/
│   │   │   ├── ChatView.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── InputBar.tsx
│   │   │   └── MicButton.tsx
│   │   ├── hooks/
│   │   │   └── useChat.ts
│   │   ├── App.tsx
│   │   └── index.tsx
│   │
│   ├── core/                     # Intent parsing + routing (shared TS logic, runs in main process)
│   │   ├── intentParser/
│   │   │   ├── cloudClient.ts    # Cloud LLM API calls
│   │   │   └── localClient.ts    # Ollama HTTP calls (v2+)
│   │   ├── skillRouter.ts
│   │   └── models/
│   │       └── commandSchema.ts  # { skill, params } structured type
│   │
│   ├── skills/                   # Self-contained executor modules
│   │   ├── openApp/
│   │   ├── openUrl/
│   │   ├── webSearch/
│   │   ├── browserAutomation/    # Playwright-driven skills (Netflix etc.)
│   │   └── nativeAppAutomation/  # UIA-driven skills (WhatsApp etc., v3)
│   │
│   ├── voice/                    # whisper.cpp integration (v2)
│   │   ├── audioCapture.ts
│   │   ├── vad.ts
│   │   └── whisperClient.ts
│   │
│   ├── prediction/               # v3 only
│   │   ├── logger/               # writes app-switch events to SQLite
│   │   ├── trainer/              # Python: offline training script, exports .onnx (not part of the app bundle)
│   │   └── inference/            # onnxruntime-node: loads .onnx, predicts next action
│   │
│   └── storage/
│       ├── db.ts                 # better-sqlite3 wrapper
│       └── schema.sql
│
├── config/
│   └── settings.json             # user prefs: default browser, LLM provider, etc.
│
├── tests/
│
├── package.json
├── tsconfig.json
├── electron-builder.yml
│
└── docs/
    ├── product.md
    ├── architecture.md
    ├── rules.md
    ├── phases.md
    └── design.md
```

## 4. Key Architectural Decisions
- **Skill-based routing**: every capability is a self-contained module with a defined input schema (same pattern as Alexa/Google Assistant slot-filling). New capabilities are added without touching core routing logic.
- **Cloud-first prototyping, local-first release**: intent parsing starts on a cloud LLM API to move fast, then swaps to a local model once the command schema is stable — this is a swap of the `intent_parser` client, not a rearchitecture.
- **Browser automation over native automation by default**: Playwright is preferred wherever a task can be done through a website, since native UIA integrations are fragile and break on app updates.
- **Separation of the popup UI from the skill execution layer**: the popup never calls executors directly — everything routes through the skill router, so the UI stays dumb and swappable.

## 5. Non-Functional Requirements
- Tray process idle footprint should stay minimal (target: low background CPU/RAM — exact numbers to be benchmarked once MVP exists)
- Popup open latency: near-instant (<200ms perceived) from click to visible window
- No action executes without a clear structured command — the intent parser must never trigger a skill on low-confidence/ambiguous output without confirming with the user first