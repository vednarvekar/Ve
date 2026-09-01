# Ve

**An assistant that learns you — without learning on you.**

Ve is a desktop assistant that sits in the system tray and actually does things: type or speak a request and it opens the app, finds the show, runs the search — instead of just answering questions about it. The part that makes it different: it learns your routines entirely on-device, and improves over time through **federated learning** — sharing only encrypted model updates, never raw personal data.

> ⚠️ **Status**: Early development / brainstorming-to-build phase. Architecture and phases are defined; implementation is in progress. Not yet usable end-to-end.

---

## What it does

- **Executes real actions** — opens apps, opens URLs, runs web searches, and (via browser automation) finds and opens specific content on sites like Netflix.
- **Tray-native, not app-native** — a custom popup opens near the system tray, styled like a native Windows flyout, not a separate window competing for your attention.
- **Type or speak instructions** — a simple chat interface with a text bar and mic button.
- **Learns on-device** — remembers your preferences (like default browser) and usage patterns without sending behavioral data anywhere.
- **Federated learning is the core goal, not a footnote** — Ve trains locally, then contributes only encrypted/aggregated model updates to improve prediction quality across users, with raw data never leaving any individual device. Everything else in the project — the tray shell, the skill system, local prediction — exists as the substrate this needs to run on.
- **Predictive startup suggestions (planned)** — a feature built on top of the learning layer: Ve suggests likely next actions on boot, shown only when confidence is high.

## Why

Assistants that personalize usually do it by shipping your data to a server. Ve is an attempt to do the personalization differently: local training + federated aggregation instead of centralized data collection, wrapped in an assistant that's actually useful day-to-day (not just a research demo). It's scoped realistically — not a general "control any app" agent, which remains unsolved even at scale — but built with federated learning as the actual point, not an afterthought.

## Tech Stack

Full JavaScript/TypeScript, front to back:

- **Shell**: Electron (Node.js/TS main process + React/TS renderer)
- **Intent parsing**: Cloud LLM API (prototyping) → local model via Ollama (privacy release)
- **Voice input**: whisper.cpp (local, offline speech-to-text)
- **Browser automation**: Playwright
- **Storage**: SQLite (`better-sqlite3`)
- **Prediction model** (v3): trained offline in Python, exported to ONNX, run at inference via `onnxruntime-node` — Python never runs inside the shipped app

See [`docs/architecture.md`](./docs/architecture.md) for the full breakdown, app flow diagram, and file structure.

## Architecture (high level)

```
Tray icon → Popup chat UI (text + mic)
          → Intent Parser (LLM)
          → Skill Router
          → Executors (app launch / URL open / browser automation)
          → Result shown in chat + logged locally
```

Every capability is a self-contained **skill module** with a defined input schema — new actions are added without touching core routing logic, the same pattern used internally by assistants like Alexa and Google Assistant.

## Project Docs

- [`docs/product.md`](./docs/product.md) — vision, requirements, feature set (MVP → v3), success criteria
- [`docs/architecture.md`](./docs/architecture.md) — tech stack, app flow, file structure, key decisions
- [`docs/rules.md`](./docs/rules.md) — do's and don'ts across product, privacy, automation, and process
- [`docs/phases.md`](./docs/phases.md) — build roadmap, phase by phase
- [`docs/design.md`](./docs/design.md) — colors, typography, theming, motion, accessibility

## Roadmap Snapshot

1. Tray shell + hardcoded commands (prove the UI loop)
2. Skill router architecture
3. LLM-based intent parsing (cloud first)
4. Voice input (whisper.cpp)
5. Real executors (browser automation, smart defaults)
6. Swap to local LLM (Ollama) for offline intent parsing
7. Local prediction (on-device model, powers startup suggestions — foundation for FL)
8. **Federated learning** — local training + encrypted model-update sharing across users
9. Hardening (error handling, settings, permissions)

Full detail in [`docs/phases.md`](./docs/phases.md).

## Explicitly Out of Scope

- Fully general "control any app" agentic reasoning
- Mobile app / cross-device sync
- Multi-user or enterprise features

## License

TBD.