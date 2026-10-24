# Ve — Product Definition

## One-liner

A local-first desktop assistant that interprets natural-language requests, safely executes a bounded set of computer actions, and may later personalize suggestions from local behavior. A compact on-device model is a hypothesis to validate, not a shipped product capability.

## Vision

Ve is a local-first desktop assistant that understands a user's request, finds the relevant app, website, or user file, and carries out the task with minimal delay and resource use. The Jarvis comparison describes the feel of the experience; the product is built in deliberate capability layers, starting with dependable everyday tasks and expanding safely.

The intent is to avoid per-command AI service costs by doing command understanding and task planning locally on modest hardware. Deterministic methods should handle simple, known operations; a compact on-device model should be used only if it improves understanding without imposing heavy CPU, memory, or battery costs. The repository currently contains an ONNX embedding-based intent prototype, not a proven general task model. New command interactions are not automatically recorded for learning while explicit opt-in and data controls are unfinished. Older builds may have left behavior samples in the local database; this change does not remove them. Future learning requires clear inspection, pause, and deletion controls.

Federated learning is a research direction, not a current product guarantee. The local FedAvg prototype is not connected to a network and does not implement secure aggregation or differential privacy. Any future network protocol needs a reviewed privacy design and measured utility before using real user data.

## Core idea

```
You say something natural  →  Small on-device model understands it
                           →  Ve executes the action on your desktop
                           →  With your permission, Ve learns from your behavior
                           →  Ve can make better suggestions if that learning proves useful
                           →  Federated learning makes everyone's Ve smarter
```

## What Ve does

### Understand natural language input
A user types a command in natural language. The current prototype combines ONNX embedding-based intent matching with deterministic fallback rules; quality and confidence calibration still need measurement. Voice and a production SLM are future work.

**Example goals (planned end-to-end workflows):**
- "Open The Mentalist" → find a supported streaming source, such as Netflix, and open the title.
- "Play music on Spotify" → open the installed Spotify app or supported Spotify integration.
- "Open the PDF from my downloads" → find a matching file in an allowed folder and open it with the system's associated app.
- "Send this file to Ved on WhatsApp" → identify the selected file and contact, show both, then prepare an official chat handoff for the user to attach/review/send. Automatic personal-account sending depends on a supported integration and is not assumed.

### Understand a goal and carry it out
Ve should interpret a goal, discover relevant resources on the user's system or the web, select a safe route, perform the requested steps, and report what happened. Examples include “open the Mentalist” (find a legal streaming source such as Netflix, then open the title there), “play music on Spotify,” “open the PDF from my downloads,” or “send this file to Ved on WhatsApp.” These are product examples, not claims that the current prototype supports them end to end.

**Capability layers:**
- **Discover and open** — find installed apps dynamically through OS app catalogs; open websites, user-selected files, and supported document types without maintaining a hardcoded app list.
- **Find and choose** — search permitted local folders for a requested file, or use an explicitly disclosed online lookup to find where a title is available.
- **Perform app tasks** — use supported OS protocols and focused app/site adapters for tasks such as playing a track on Spotify or opening a show on a streaming service. An installed app can be launched generically; performing its internal tasks may need a supported integration.
- **Transfer and communicate** — prepare a selected file or message through supported integrations, show the exact recipient and payload, and require user approval; use a manual handoff where the service has no supported personal-account send API.
- **Grow carefully** — add system controls and multi-step workflows only with scoped permissions, progress visibility, cancellation, and clear confirmation for side effects.

Ve should not rely on a fixed list of app names in core intent logic. It may maintain generic platform adapters and user-installable integrations, but app discovery and launching should be based on the operating system's installed-app inventory.

### Security and trust boundary
Ve must not become a general-purpose remote-control backdoor. Treat user text, model output, web content, files, app metadata, and IPC requests as untrusted. The model may propose only registered capabilities; it must never produce shell commands or choose arbitrary paths to read. Use least-privilege file access, scoped app integrations, validated IPC, and main-process policy enforcement. Ask before sensitive actions and show the exact recipient and file before sharing. Avoid broad filesystem crawling, credential stores, admin access, and silent external transfers. A compromised account or host cannot be made “foolproof”; the design should limit what Ve can access and make abuse harder to turn into data theft or destructive actions.

### Learn and personalize on-device
If the user enables learning, eligible interactions can help Ve personalize over time. The product must not silently train on every interaction. Candidate signals include:

- **Usage patterns** — what apps you use, when, and in what order
- **Command preferences** — how you phrase things, your vocabulary and shortcuts
- **Context signals** — time of day, day of week, previous action, active window
- **Feedback loops** — accepted vs. dismissed suggestions, corrected commands

Learning data should stay local. The user must be able to inspect, export, pause, or delete it.

### Proactive suggestions
Once Ve has enough local data, it can suggest actions before you ask — like a startup suggestion ("Open VS Code? You usually do at this time") or a follow-up ("You just opened Chrome — want to go to GitHub?"). Suggestions only appear above a confidence threshold and are always dismissable.

### Federated learning (research direction)
The current local FedAvg function is an algorithm prototype only. A future opt-in design would need secure aggregation, a documented differential privacy budget, cohort protections, signed artifacts, and a privacy/security review before any real updates are transmitted. No federated server or networked client currently exists. Ve must remain useful with federation disabled.

## The SLM — why small matters

| Property | Ve's approach |
|---|---|
| **Model size** | Compact model is a target to evaluate against a deterministic/classifier baseline |
| **Inference** | Measure CPU latency and memory on declared hardware before setting release targets |
| **Privacy** | Core path should work locally; explicitly disclose any future networked feature |
| **Personalization** | Local action predictor prototype; utility and controls need validation |
| **Bandwidth** | No federated network traffic exists in the current app |
| **Scope** | Task-oriented assistant that discovers local resources and invokes scoped capabilities |

The model is not trying to be GPT. The product question is whether a compact classifier or language model can improve a bounded command set over deterministic rules. A 10–20M parameter target and associated performance claims remain hypotheses until benchmarked on supported hardware.

**Model responsibilities:**
1. **Intent parsing** — "open chrome" → `{ skill: "openApp", params: { target: "chrome" } }`
2. **Entity extraction** — "message mom on whatsapp" → `{ contact: "mom", app: "whatsapp" }`
3. **Resource discovery** — find installed apps and scoped local files, or disclosed online sources
4. **Ambiguity and risk handling** — clarify uncertain targets and request approval for sensitive actions
5. **Task planning** — turn a goal into visible, cancellable steps using registered capabilities
6. **Optional personalization** — learn user preferences locally over time

## Who it's for

**Primary:** The builder (Ved) and technically comfortable power users who:
- Want a desktop assistant that actually *does things*, not just answers questions
- Care about privacy and don't want behavioral data in someone else's cloud
- Want low-latency, offline-capable AI without heavy GPU requirements
- Value an assistant that gets smarter the more they use it
- Want to extend functionality through modular skills

**Not for (right now):** Non-technical users who expect polished consumer UX, enterprise teams, mobile users.

## Product principles

1. **Act, don't chat** — Ve's job is to execute tasks, not hold conversations. Every interaction should end in an action or a clear reason why it can't.
2. **Lightweight by default** — avoid requiring a GPU or constant cloud inference; measure CPU, memory, battery, and latency on target systems.
3. **Local by default** — intent understanding and local file/app discovery stay on-device; disclose online lookups and require approval for sensitive external actions.
4. **Learn with permission** — personalize only after the user enables learning and can inspect, pause, and delete its data.
5. **Transparent uncertainty** — when Ve isn't sure, it asks. It never guesses and executes a wrong action.
6. **Modular capabilities** — app-specific tasks use scoped integrations; discovering and launching installed apps should not require hardcoding every app into the intent parser.
7. **Calm intelligence** — proactive suggestions only when confidence is high. Wrong suggestions destroy trust faster than no suggestions.

## Tech stack

| Layer | Technology | Notes |
|---|---|---|
| **Shell** | Electron (Node.js/TypeScript) | System tray app with frameless popup UI |
| **UI** | React + Tailwind CSS | Chat interface, suggestions, confirmations |
| **Intent runtime** | ONNX Runtime (current prototype) | Embedding-based intent matching; not a validated generative SLM |
| **Intent parsing** | Local prototype + deterministic fallback | Benchmark and confidence calibration remain roadmap work |
| **Desktop automation** | OS APIs + Playwright (browser) | App launch, system control, browser automation |
| **Local storage** | SQLite via Node `node:sqlite` (current prototype) | Behavior context, contacts, notes, and local prediction state |
| **Voice** | Local push-to-talk speech-to-text (planned) | sherpa-onnx streaming Zipformer English 20M int8 is the benchmark candidate; transcript must be reviewed before sending |
| **Federated learning** | Research direction | Local FedAvg prototype only; no secure aggregation, DP, coordinator, or network client |

## Current state

The current implementation has:
- ✅ Electron tray app with frameless chat popup
- ✅ React chat UI with text input
- ⬜ Required primary floating launcher with Chat / Voice / Hide-to-tray actions
- ✅ Deterministic fallback and ONNX embedding-based intent prototype (not benchmarked as an SLM)
- ✅ Skill registry/router and app, browser, and WhatsApp modules (policy coverage is incomplete)
- ✅ Local softmax action predictor prototype and FedAvg primitive (prediction use is disabled pending opt-in; federation is not networked)
- ✅ SQLite storage, privacy sanitizer, behavior context, and user-managed contacts/notes; automatic behavior collection is disabled pending opt-in controls
- ⬜ Complete main-process policy gate and confirmation lifecycle
- ⬜ Dynamic installed-app discovery and launch without a hardcoded app catalog
- ⬜ User-scoped file search and safe open for PDFs/images
- ⬜ Online availability lookup and focused Spotify/streaming integrations
- ⬜ Confirmed file attachment and WhatsApp send flow
- ⬜ Validated intent quality, confidence calibration, and supported-platform behavior
- ⬜ Browser automation
- ⬜ Voice input
- ⬜ System-level controls (volume, brightness, etc.)
- ⬜ User-facing data export, retention, and full learning controls
- ⬜ Federated server, secure aggregation, and differential privacy
- ⬜ Packaging and distribution

See [`requirements.md`](./requirements.md) for the full capability and security requirements and [`roadmap.md`](./roadmap.md) for ordered implementation steps and delivery status.

## What success looks like

1. **Reliable actions:** Supported requests map to the correct validated skill; ambiguous or unsupported requests do not execute.
2. **Responsive interaction:** Measure end-to-end latency on declared hardware and set targets from results.
3. **Useful personalization:** Enable suggestions only after opt-in evaluation shows utility and acceptable false-positive rates.
4. **User control:** Users can understand, pause, export, and delete data used for learning.
5. **Extensible skills:** New capabilities use shared validation and policy.
6. **Federation evidence:** Consider networking only after simulation shows utility and a privacy protocol is reviewed.

## Open decisions

- Whether a compact SLM is needed after benchmarking simpler approaches
- Model/runtime choice and acceptable accuracy, latency, and memory thresholds
- Validate the sherpa-onnx Zipformer English 20M int8 voice candidate against alternatives and choose initial language/platform support (roadmap Step 1.4)
- Target OS scope — Windows-first, but is Linux a dev convenience or a product target?
- Federation coordinator infrastructure and secure aggregation mechanism
- First skill set beyond the current three
- Packaging, auto-update, and distribution strategy
