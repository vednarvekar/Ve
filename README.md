# Ve

**An assistant that learns you — without learning on you.**

Ve is a lightweight, local-first desktop assistant prototype. The product direction is to understand a user's goal, dynamically find relevant installed apps or user-scoped files, discover online sources when requested, and carry out the task through safe integrations. The Jarvis comparison describes the experience, not a promise of unrestricted control. Federated learning remains an unconnected research prototype, with no server or model updates sent anywhere.

> **Status:** Early prototype. See [Current implementation](#current-implementation) and the dependency-ordered [roadmap](./docs/roadmap.md) for what works and what remains.

---

## What it does

- **Executes a bounded set of actions** — app launch, URL navigation, search, and WhatsApp flow modules exist; validation, policy/confirmation coverage, platform support, and end-to-end reliability still need work.
- **Floating launcher is part of the product** — the movable Ve orb is the primary visible entry point; Hide moves it to the tray, where users can restore it. This shell behavior is planned, not implemented.
- **Goal-oriented workflows are the direction** — examples include finding a show on a streaming service, opening a PDF in an approved folder, or sharing a selected file through a confirmed messaging integration; these are not current end-to-end features.
- **Apps should be discovered dynamically** — use OS-installed app catalogs for launch; internal app actions need focused integrations, not a hardcoded app list or unrestricted control.
- **Floating launcher with tray minimize/restore** — the movable orb opens chat/actions; Hide moves Ve to the tray without quitting.
- **Type instructions today; voice is planned** — the chat input works, while the mic button is currently a disabled placeholder.
- **Local data and prediction prototypes exist** — SQLite stores local behavior/context and explicit contacts/notes; a local predictor can rank actions. This is not yet a validated personalization feature.
- **Federated learning is exploratory** — a local FedAvg primitive exists, but there is no secure aggregation, differential privacy, coordinator, or network transfer.
- **Predictive startup suggestions (planned)** — a feature built on top of the learning layer: Ve suggests likely next actions on boot, shown only when confidence is high.

## Why

Assistants that personalize often rely on centralized data. Ve explores local personalization, with federated learning as a possible later research direction. The immediate goal is a reliable, bounded assistant; it is not a general "control any app" agent.

## Tech Stack

Full JavaScript/TypeScript, front to back:

- **Shell**: Electron (Node.js/TS main process + React/TS renderer)
- **Intent parsing**: ONNX embedding-based local prototype plus deterministic fallback; quality and confidence are not yet benchmarked
- **Voice input**: planned local speech-to-text; no voice runtime exists yet
- **Browser automation**: planned Playwright-based skills; not installed or implemented yet
- **Storage**: local SQLite via Node's built-in `node:sqlite`; retention and user-facing data governance need completion
- **Prediction model**: simple local action predictor exists; no production training pipeline or validated SLM exists

See [`docs/architecture.md`](./docs/architecture.md) for the target architecture, and [`docs/roadmap.md`](./docs/roadmap.md) for the implementation roadmap.

## Current implementation

- Electron tray shell, React chat popup, and text input.
- Local ONNX embedding intent prototype and deterministic fallback; this is not yet a demonstrated 10–20M generative model.
- Skill registry/router and app, browser, and WhatsApp modules; execution safety and confirmation are not yet complete across all actions.
- SQLite local storage, privacy sanitizer, user-managed contacts/notes, action-event history, and a simple local action predictor.
- FedAvg aggregation prototype that runs locally only. It is not secure aggregation and has no differential privacy guarantee or server connection.
- Voice input is a disabled placeholder; release packaging is not complete.

## Architecture (high level)

```
Tray icon → Popup chat UI (text + mic)
          → Intent Parser (local prototype + deterministic fallback)
          → Skill Router
          → Executors (app launch / URL open / browser automation)
          → Result shown in chat + logged locally
```

The target design uses self-contained **skill modules** with defined input schemas. The repository has a skill registry/router and modules; consistent contracts, policy enforcement, and confirmations remain roadmap work.

## Project Docs

- [`docs/roadmap.md`](./docs/roadmap.md) — dependency-ordered delivery milestones and acceptance criteria
- [`docs/requirements.md`](./docs/requirements.md) — product, capability, model, security, and quality requirements with research references
- [`docs/product.md`](./docs/product.md) — vision, users, scope, and product requirements
- [`docs/architecture.md`](./docs/architecture.md) — target runtime architecture and security boundaries
- [`docs/federated-learning.md`](./docs/federated-learning.md) — learning objective, privacy model, protocol, and evaluation
- [`docs/rules.md`](./docs/rules.md) — do's and don'ts across product, privacy, automation, and process
- [`docs/design.md`](./docs/design.md) — colors, typography, theming, motion, accessibility

## Roadmap Snapshot

1. Establish the threat model and secure command boundary
2. Finish tray behavior and build the required floating launcher
3. Discover installed apps and launch them dynamically
4. Search approved file locations and open selected files safely
5. Add disclosed online lookup and focused app integrations
6. Add safe sharing handoffs and validate intent quality

Full detail in [`docs/roadmap.md`](./docs/roadmap.md).

## Explicitly Out of Scope

- Fully general "control any app" agentic reasoning
- Mobile app / cross-device sync
- Multi-user or enterprise features

## License

TBD.
