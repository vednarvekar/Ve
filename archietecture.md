# Ve — Architecture Document

## 1. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Shell / Tray UI | C# + WinUI 3 (or WPF as fallback) | Best native Windows tray integration; Tauri (Rust + web frontend) is the lighter-weight alternative if UI dev speed matters more than native polish |
| Speech-to-text | whisper.cpp | Local, offline, CPU-friendly |
| Intent parsing | Cloud LLM API (prototype) → local model via Ollama (Phi-3-mini or Llama-3.2-3B) for privacy release | Cloud first for iteration speed; local swap-in once schema is stable |
| Browser automation | Playwright | More stable than native UI Automation for web-based actions |
| Native app automation | Windows UI Automation (UIA) | Only for specific high-value, hand-maintained integrations; treated as fragile/expensive per-app |
| Local storage | SQLite | Preferences, command history, logs for prediction model |
| Prediction model (v3) | Markov chain / GBDT, exported to ONNX | Small, fast, runs in the Go/C# agent without a Python runtime dependency at inference time |

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
│   ├── shell/                  # Tray icon + popup UI (C#/WinUI or Tauri)
│   │   ├── TrayIcon.cs
│   │   ├── PopupWindow/
│   │   │   ├── ChatView.xaml
│   │   │   ├── ChatViewModel.cs
│   │   │   └── MicButton.cs
│   │   └── App.cs
│   │
│   ├── core/                   # Intent parsing + routing (language-agnostic logic)
│   │   ├── intent_parser/
│   │   │   ├── cloud_client.cs       # Cloud LLM API calls
│   │   │   └── local_client.cs       # Ollama calls (v2+)
│   │   ├── skill_router.cs
│   │   └── models/
│   │       └── command_schema.cs     # { skill, params } structured type
│   │
│   ├── skills/                 # Self-contained executor modules
│   │   ├── open_app/
│   │   ├── open_url/
│   │   ├── web_search/
│   │   ├── browser_automation/       # Playwright-driven skills (Netflix etc.)
│   │   └── native_app_automation/    # UIA-driven skills (WhatsApp etc., v3)
│   │
│   ├── voice/                  # whisper.cpp integration (v2)
│   │   ├── audio_capture.cs
│   │   ├── vad.cs
│   │   └── whisper_client.cs
│   │
│   ├── prediction/              # v3 only
│   │   ├── logger/               # writes app-switch events to SQLite
│   │   ├── trainer/              # Python: trains model, exports .onnx
│   │   └── inference/            # loads .onnx, predicts next action
│   │
│   └── storage/
│       ├── db.cs                 # SQLite wrapper
│       └── schema.sql
│
├── config/
│   └── settings.json             # user prefs: default browser, LLM provider, etc.
│
├── tests/
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