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
- **Current app launch is limited** — the prototype supports a fixed alias list (Chrome, Firefox, VS Code, Calculator, Notepad, Terminal, File Explorer); dynamic discovery is not implemented.
- **Type instructions today; voice is planned** — the chat input works, while the mic button is currently a disabled placeholder.
- **Local storage and prediction prototypes exist** — SQLite stores explicit contacts/notes and may contain behavior samples from earlier builds. New commands are not automatically recorded, and old samples are not used for suggestions until learning has an opt-in flow. This is not a validated personalization feature.
- **Online handoffs disclose their destination data** — search terms go to the selected search provider; WhatsApp handoff opens a `wa.me` URL containing the phone number and prefilled message.
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
- **Prediction model**: a local action predictor exists but its suggestion path is disabled pending opt-in controls; no production training pipeline or validated SLM exists

See [`docs/architecture.md`](./docs/architecture.md) for the target architecture, and [`docs/roadmap.md`](./docs/roadmap.md) for the implementation roadmap.

## Current implementation

- Electron tray shell, React chat popup, and text input.
- Local ONNX embedding intent prototype and deterministic fallback; this is not yet a demonstrated 10–20M generative model.
- Skill registry/router and app, browser, and WhatsApp modules; execution safety and confirmation are not yet complete across all actions.
- SQLite local storage, privacy sanitizer, user-managed contacts/notes, and a simple local action predictor. The command path no longer records new behavior samples by default; existing database samples may remain until cleared.
- Search/navigation commands open URLs in the system browser, which sends online search terms to the chosen provider. There is no direct AI API or background network client in the current command path.
- FedAvg aggregation prototype that runs locally only. It is not secure aggregation and has no differential privacy guarantee or server connection.
- Voice input is a disabled placeholder; release packaging is not complete.

## Architecture (high level)

```
Tray icon → Popup chat UI (text + disabled mic)
          → Intent Parser (local prototype + deterministic fallback)
          → Skill Router
          → Executors (app launch / URL open / browser search)
          → Result shown in chat
```

Browser actions currently open search/navigation URLs in the system browser; Ve does not automate browser workflows.

The target design uses self-contained **skill modules** with defined input schemas. The repository has a skill registry/router and modules; consistent contracts, policy enforcement, and confirmations remain roadmap work.

## Project Docs

- [`docs/roadmap.md`](./docs/roadmap.md) — dependency-ordered delivery milestones and acceptance criteria
- [`docs/requirements.md`](./docs/requirements.md) — product, capability, model, security, and quality requirements with research references
- [`docs/implementation-baseline.md`](./docs/implementation-baseline.md) — source-audited command paths, data fields, external handoffs, and platform limitations
- [`docs/product.md`](./docs/product.md) — vision, users, scope, and product requirements
- [`docs/architecture.md`](./docs/architecture.md) — target runtime architecture and security boundaries
- [`docs/federated-learning.md`](./docs/federated-learning.md) — learning objective, privacy model, protocol, and evaluation
- [`docs/rules.md`](./docs/rules.md) — do's and don'ts across product, privacy, automation, and process
- [`docs/design.md`](./docs/design.md) — colors, typography, theming, motion, accessibility

## Roadmap Snapshot

1. Establish a truthful behavior and security baseline
2. Finish tray behavior and build the required floating launcher
3. Define the threat model, typed command contracts, and bounded workflow engine
4. Discover installed apps and launch them dynamically
5. Search approved file locations and open selected files safely
6. Add disclosed online lookup, focused app integrations, and safe sharing handoffs

Full detail in [`docs/roadmap.md`](./docs/roadmap.md).

## Explicitly Out of Scope

- Fully general "control any app" agentic reasoning
- Mobile app / cross-device sync
- Multi-user or enterprise features

## License

TBD.
