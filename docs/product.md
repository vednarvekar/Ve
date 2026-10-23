# Ve — Product Definition

## One-liner

A personal desktop assistant powered by a tiny on-device language model (~10–20M parameters) that understands natural language, executes real actions on your computer, and learns your habits locally — without ever sending your data to a server.

## Vision

Ve is Jarvis for your desktop — built small, private, and personal.

Instead of relying on massive cloud LLMs, Ve runs a compact language model (10–20 million parameters) entirely on-device. This model is small enough to run on any modern machine without a GPU, yet capable enough to understand freeform natural language commands and map them to desktop actions. Over time, Ve observes how you work — which apps you open, when you open them, what you search for — and trains itself locally to anticipate what you need next.

The long-term differentiator is **federated learning**: users who opt in contribute encrypted model weight updates (never raw data) to a shared training pool, so every Ve instance gets smarter from collective patterns while every user's actual behavior stays on their own machine.

## Core idea

```
You say something natural  →  Small on-device model understands it
                           →  Ve executes the action on your desktop
                           →  Ve learns from what you do
                           →  Ve gets better at predicting what you'll need
                           →  Federated learning makes everyone's Ve smarter
```

## What Ve does

### Understand natural language input
A user types or speaks a command in natural, unstructured language. Ve's on-device SLM parses intent — no cloud call, no latency, no data leaving the machine.

**Examples:**
- "open chrome and go to youtube"
- "search for flights to goa next week"
- "send a whatsapp message to mom"
- "play some lofi on spotify"
- "close all browser tabs and open my coding setup"

### Execute real desktop actions
Ve doesn't just answer questions — it acts. It can launch apps, open URLs, automate browser workflows, manage windows, trigger system commands, and orchestrate multi-step tasks across applications.

**Action categories:**
- **App control** — launch, close, switch between, and arrange applications
- **Browser automation** — navigate, search, fill forms, extract information
- **System operations** — volume, brightness, wifi, bluetooth, power, files
- **Communication** — send messages via WhatsApp Web, compose emails
- **Workflow chains** — multi-step sequences triggered by a single command
- **Custom skills** — user-defined or community-contributed action modules

### Learn and personalize on-device
Every successful interaction teaches Ve about the user. The on-device model continuously fine-tunes itself based on:

- **Usage patterns** — what apps you use, when, and in what order
- **Command preferences** — how you phrase things, your vocabulary and shortcuts
- **Context signals** — time of day, day of week, previous action, active window
- **Feedback loops** — accepted vs. dismissed suggestions, corrected commands

All learning data stays local. The user can inspect, export, pause, or delete it at any time.

### Proactive suggestions
Once Ve has enough local data, it can suggest actions before you ask — like a startup suggestion ("Open VS Code? You usually do at this time") or a follow-up ("You just opened Chrome — want to go to GitHub?"). Suggestions only appear above a confidence threshold and are always dismissable.

### Federated learning (long-term)
Users who opt in contribute to a federated training process:
- Each device trains locally on its own behavioral data
- Only encrypted, clipped, differentially-private model weight updates are sent
- A coordinator aggregates updates from a minimum cohort
- A better global model is signed and distributed back to all participants
- Raw commands, URLs, app names, transcripts — never leave the device

The assistant remains fully functional with federation disabled.

## The SLM — why small matters

| Property | Ve's approach |
|---|---|
| **Model size** | 10–20M parameters — fits in RAM on any modern laptop |
| **Inference** | CPU-only, sub-100ms latency, no GPU required |
| **Privacy** | Runs entirely on-device — no cloud dependency for core function |
| **Personalization** | Continuously fine-tunes locally on user behavior |
| **Bandwidth** | Zero for daily use; minimal for optional federated updates |
| **Scope** | Not a general chatbot — purpose-built for intent parsing + action prediction |

The model is not trying to be GPT. It's a focused intent-understanding and action-prediction model trained for a constrained task: turn natural language into structured desktop commands. A 10–20M parameter model can do this well because the output space (action categories + parameters) is bounded.

**Model responsibilities:**
1. **Intent parsing** — "open chrome" → `{ skill: "openApp", params: { target: "chrome" } }`
2. **Entity extraction** — "message mom on whatsapp" → `{ contact: "mom", app: "whatsapp" }`
3. **Ambiguity resolution** — detect when a command is unclear and ask for clarification
4. **Action prediction** — given context (time, recent actions), predict likely next actions
5. **Personalized language adaptation** — learn the user's phrasing patterns over time

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
2. **Tiny and fast** — sub-100ms response on CPU. No loading spinners, no "thinking..." delays for common commands.
3. **Local by default** — all data, all inference, all learning happens on-device unless the user explicitly opts into federation.
4. **Learn by doing** — every interaction makes Ve smarter for that specific user. No manual configuration or training required.
5. **Transparent uncertainty** — when Ve isn't sure, it asks. It never guesses and executes a wrong action.
6. **Modular skills** — new capabilities are self-contained skill modules. Adding "control Spotify" doesn't require touching the core.
7. **Calm intelligence** — proactive suggestions only when confidence is high. Wrong suggestions destroy trust faster than no suggestions.

## Tech stack

| Layer | Technology | Notes |
|---|---|---|
| **Shell** | Electron (Node.js/TypeScript) | System tray app with frameless popup UI |
| **UI** | React + Tailwind CSS | Chat interface, suggestions, confirmations |
| **SLM runtime** | TBD (ONNX Runtime / llama.cpp / custom) | On-device inference for the 10–20M param model |
| **Intent parsing** | On-device SLM + deterministic fallback | Model parses natural language; rules handle known patterns |
| **Desktop automation** | OS APIs + Playwright (browser) | App launch, system control, browser automation |
| **Local storage** | JSON file (current) → SQLite (planned) | Behavioral events, user data, model weights |
| **Voice** | Local speech-to-text (planned) | Offline voice input feeding into the same pipeline |
| **Federated learning** | Custom FL protocol | FedAvg prototype exists; secure aggregation planned |

## Current state

The current implementation has:
- ✅ Electron tray app with frameless chat popup
- ✅ React chat UI with text input
- ✅ Deterministic command parsing (app launch, URL open, web search)
- ✅ On-device softmax predictor for action prediction
- ✅ FedAvg aggregation prototype (not connected to network)
- ✅ Local behavioral data storage with user controls
- ✅ User-managed contacts and notes
- ⬜ On-device SLM for natural language understanding
- ⬜ Skill router and policy gate
- ⬜ Browser automation
- ⬜ Voice input
- ⬜ System-level controls (volume, brightness, etc.)
- ⬜ Federated learning server and secure aggregation
- ⬜ Packaging and distribution

See [`roadmap.md`](./roadmap.md) for implementation milestones and delivery status.

## What success looks like

1. **A user says something natural and Ve does it** — no special syntax, no memorizing commands. The on-device model handles the interpretation.
2. **It's instant** — common actions complete in under 200ms end-to-end.
3. **It gets smarter** — after a week of use, Ve predicts your morning routine, your post-lunch workflow, your common searches.
4. **Your data stays yours** — everything runs locally. A user can air-gap their machine and Ve still works perfectly.
5. **Skills are pluggable** — adding a new capability is writing a module with an input schema and an executor, not rewriting the assistant.
6. **Federation actually improves the model** — in simulation, the federated global model outperforms any single-device model, without requiring raw behavioral data.

## Open decisions

- SLM architecture and training approach (distillation from large model? train from scratch on intent data?)
- Runtime for on-device inference (ONNX Runtime, llama.cpp, TF Lite, or custom?)
- Voice STT engine (Whisper.cpp? Vosk? other local options?)
- Target OS scope — Windows-first, but is Linux a dev convenience or a product target?
- Federation coordinator infrastructure and secure aggregation mechanism
- First skill set beyond the current three
- Packaging, auto-update, and distribution strategy
