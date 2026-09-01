# Ve — Rules

## Product Rules

**Do**
- Keep every proactive interruption (startup suggestions, unsolicited popups) high-confidence only — wrong or low-value suggestions erode trust fast and are worse than no suggestion.
- Make dismissal of any popup/suggestion a single click/keypress, no modal-stealing focus.
- Always show a clear success or failure state after an action — never leave the user guessing whether something happened.
- Default to on-demand (hotkey/click-triggered) interaction. Reserve unprompted popups strictly for the high-confidence prediction feature.
- Treat every new "skill" (app/site integration) as its own scoped mini-task, not a quick bolt-on.

**Don't**
- Don't pop up automatically on every boot without a clear opt-in — this repeats the exact annoyance risk identified early in scoping.
- Don't let the assistant guess and execute on ambiguous/low-confidence intent — confirm with the user first.
- Don't build the general "control any app" agent — explicitly out of scope; resist scope creep toward it.
- Don't silently fail. If a skill can't complete, say so and suggest an alternative.

## Privacy & Data Rules

**Do**
- Keep raw logs (app usage, command history) local by default (SQLite on-device).
- Make any cloud LLM call an explicit, visible action to the user (e.g. indicated in UI), not a silent background call.
- Give the prediction/logging feature a clear off-switch.

**Don't**
- Don't upload raw behavioral logs anywhere, ever, without explicit opt-in — this includes any future federated learning expansion (encrypted weights only, never raw data).
- Don't scan the whole filesystem or unrelated apps — only touch what the user's command scopes to.
- Don't store credentials/secrets (API keys, session tokens) in plaintext config files — use OS credential storage (Windows Credential Manager) where possible.

## Automation & Execution Rules

**Do**
- Prefer Playwright/browser automation over native UI Automation (UIA) wherever a task can be done through a website — it's more stable and maintainable.
- Log every executed action locally, including failures, for debugging and future prediction-model training.
- Treat WhatsApp Web (or any ToS-restricted) automation as a known risk — document it, don't quietly rely on it as core functionality until the tradeoff is deliberately accepted.

**Don't**
- Don't build per-app UIA scripts unless the app is high-value enough to justify ongoing maintenance (breaks on every UI update).
- Don't chain multi-step automations without a way for the user to see/interrupt what's happening mid-execution, especially once actions get more complex (v3+).

## Development Process Rules

**Do**
- Build and validate the UI/interaction loop with hardcoded commands before adding LLM intent parsing — prove the shell works before adding intelligence.
- Prototype new architectural layers (e.g. intent parsing) with the cloud API first, swap to local only once the approach is validated.
- Keep skills as isolated modules with a defined input schema — this is the extensibility mechanism, don't bypass it for "quick" one-off integrations.

**Don't**
- Don't optimize for local-model / full-privacy setup before the feature itself is proven to work with a cloud API — adds friction during iteration.
- Don't start the predictive/ML feature before the core on-demand assistant loop (tray → popup → command → execution) is solid — it's a v3 feature, not the foundation.
- Don't lock in a product name, stack detail, or UI polish decision prematurely while still in brainstorming/feasibility stage — confirm big-picture direction before feature-level investment (matches how this project's planning has actually proceeded).