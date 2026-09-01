# Ve — Build Phases

## Phase 0: Foundation & Naming
- Lock the product name (or proceed with placeholder and rename later)
- Stack confirmed: Electron + TypeScript/React, full JS/TS end to end (see architecture.md)
- Set up repo structure per architecture.md

## Phase 1: Tray Shell (UI loop, zero intelligence)
- Tray icon that sits beside system icons
- Custom popup window styled as chat UI (text bar + mic icon placeholder + message history)
- Hardcoded command matching (e.g. exact strings: "open chrome", "open notepad") just to prove the click → popup → action loop works end to end
- **Goal**: prove the interaction shell works before any intelligence is added

## Phase 2: Skill Router Architecture
- Build the skill router and command schema (`{ skill, params }`)
- Implement 3 initial skills: open app, open URL, web search
- Wire hardcoded matching through the router (not directly to executors)
- **Goal**: establish the extensibility pattern early, even with dumb input parsing

## Phase 3: LLM Intent Parsing
- Replace hardcoded matching with free-text parsing via a cloud LLM API
- Define and stabilize the intent/command schema through real usage
- Add ambiguity handling: low-confidence parses should ask for clarification, not guess
- **Goal**: validate the parsing approach fast, using cloud for iteration speed

## Phase 4: Voice Input
- Integrate whisper.cpp for local speech-to-text
- Add mic button wiring: capture → VAD → transcribe → feed into intent parser
- **Goal**: voice and text inputs converge on the same downstream pipeline

## Phase 5: Real Executors
- Smart default browser detection/preference (remembers most-used browser)
- Browser automation via Playwright for content lookup + open (e.g. Netflix search-and-open)
- Expand skill set based on actual daily usage patterns
- **Goal**: Ve becomes genuinely useful for real daily tasks, not just demos

## Phase 6: Local/Private Release Swap
- Swap cloud LLM intent parsing for a local model via Ollama (Phi-3-mini or Llama-3.2-3B)
- Benchmark accuracy/latency tradeoff vs cloud version
- **Goal**: privacy-first version becomes viable for actual daily use, not just prototype

## Phase 7: Predictive Startup Feature (local-only, foundation for FL)
- Build the data logger (app launches, timestamps, previous app) into SQLite
- Collect 3–5 days of real usage logs
- Train a lightweight model (Markov chain / GBDT) locally, export to ONNX
- Load model into the agent, trigger high-confidence-only startup suggestions
- **Goal**: prove the local learning loop works end-to-end on a single device — this is the required foundation before federated learning means anything

## Phase 8: Federated Learning (core long-term goal)
- Define what gets shared: encrypted/aggregated model updates only — never raw logs or behavioral data
- Build the local training step so it can run repeatedly on-device (not just once) as new data accumulates
- Stand up a minimal central aggregator to collect model updates from multiple devices/users and produce an improved global model
- Distribute the aggregated model back to devices; local models start from it instead of from scratch
- Validate that the aggregated model actually improves prediction quality vs. single-device-only training, without any raw data ever leaving a device
- **Goal**: this is the feature the project exists to prove out — everything in Phases 0–7 is the substrate FL needs

## Phase 9: Hardening
- Error handling and fallback messaging for every skill (never fail silently)
- Permission prompts where relevant (e.g. first-time browser automation on a site)
- Review privacy/data rules compliance across all features, especially the FL update-sharing pipeline
- Basic settings UI (preferences, LLM provider toggle, prediction/FL participation on/off)

## Explicitly Deferred (not a phase yet — revisit only if MVP+v2+v3 succeed)
- Native app automation (e.g. WhatsApp Desktop via UIA) — fragile, high maintenance, evaluate cost/benefit before starting
- Any packaging/distribution beyond personal use
- Skill plugin marketplace / third-party skill authoring