# Ve

**An assistant that learns you — without learning on you.**

Ve is intended to be a desktop assistant that sits in the system tray and performs narrowly scoped actions instead of only answering questions. The long-term differentiator is local personalization and federated learning; those learning systems are planned, not implemented yet.

> ⚠️ **Status**: Early development. The tray shell, React popup UI, and initial command router exist. Follow our delivery milestones in [`docs/roadmap.md`](./docs/roadmap.md).

---

## What it does

- **Designed to execute real actions** — the first planned skills are app launch, URL opening, and web search; executors are not yet complete in the current tree.
- **Tray-native, not app-native** — a custom popup opens near the system tray, styled like a native Windows flyout, not a separate window competing for your attention.
- **Type instructions today; voice is planned** — the chat input works, while the mic button is currently a disabled placeholder.
- **Designed for on-device learning** — persistence, local prediction, and preference learning are planned but not implemented yet.
- **Federated learning is the long-term goal** — the planned system will train locally and contribute privacy-reviewed model updates, never raw behavioral logs. The protocol and client do not exist yet.
- **Predictive startup suggestions (planned)** — a feature built on top of the learning layer: Ve suggests likely next actions on boot, shown only when confidence is high.

## Why

Assistants that personalize usually do it by shipping your data to a server. Ve is an attempt to do the personalization differently: local training + federated aggregation instead of centralized data collection, wrapped in an assistant that's actually useful day-to-day (not just a research demo). It's scoped realistically — not a general "control any app" agent, which remains unsolved even at scale — but built with federated learning as the actual point, not an afterthought.

## Tech Stack

Full JavaScript/TypeScript, front to back:

- **Shell**: Electron (Node.js/TS main process + React/TS renderer)
- **Intent parsing**: NVIDIA OpenAI-compatible cloud prototype exists; provider abstraction and local parsing are planned
- **Voice input**: planned local speech-to-text; no voice runtime exists yet
- **Browser automation**: planned Playwright-based skills; not installed or implemented yet
- **Storage**: planned local database; no persistence layer exists yet
- **Prediction model**: planned; no model, training pipeline, or inference dependency exists yet

See [`docs/architecture.md`](./docs/architecture.md) for the target architecture, and [`docs/roadmap.md`](./docs/roadmap.md) for the implementation roadmap.

## Architecture (high level)

```
Tray icon → Popup chat UI (text + mic)
          → Intent Parser (LLM / SLM)
          → Skill Router
          → Executors (app launch / URL open / browser automation)
          → Result shown in chat + logged locally
```

The target design uses self-contained **skill modules** with defined input schemas. The current repository has the schema seed but not yet the router or skill modules.

## Project Docs

- [`docs/roadmap.md`](./docs/roadmap.md) — dependency-ordered delivery milestones and acceptance criteria
- [`docs/product.md`](./docs/product.md) — vision, users, scope, and product requirements
- [`docs/architecture.md`](./docs/architecture.md) — target runtime architecture and security boundaries
- [`docs/federated-learning.md`](./docs/federated-learning.md) — learning objective, privacy model, protocol, and evaluation
- [`docs/rules.md`](./docs/rules.md) — do's and don'ts across product, privacy, automation, and process
- [`docs/design.md`](./docs/design.md) — colors, typography, theming, motion, accessibility

## Roadmap Snapshot

1. Hardened desktop shell & deterministic baseline
2. Modular skill engine & policy gate
3. Structured local data storage & training dataset generation (SQLite)
4. Desktop & browser automation (OS + Browser)
5. 10–20M parameter on-device SLM brain
6. Local on-device adaptation & federated learning loop

Full detail in [`docs/roadmap.md`](./docs/roadmap.md).

## Explicitly Out of Scope

- Fully general "control any app" agentic reasoning
- Mobile app / cross-device sync
- Multi-user or enterprise features

## License

TBD.
