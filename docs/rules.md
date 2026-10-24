# Ve — Rules

## Product Rules

**Do**
- Keep every proactive interruption (startup suggestions, unsolicited popups) high-confidence only — wrong or low-value suggestions erode trust fast and are worse than no suggestion.
- Make dismissal of any popup/suggestion a single click/keypress, no modal-stealing focus.
- Always show a clear success or failure state after an action — never leave the user guessing whether something happened.
- Default to on-demand (hotkey/click-triggered) interaction. Reserve unprompted popups strictly for the high-confidence prediction feature.
- Treat every new "skill" (app/site integration) as its own scoped mini-task, not a quick bolt-on.
- Discover installed apps from OS catalogs at runtime; do not grow a hardcoded application-name switch in the intent parser.
- For local file tasks, search only user-approved folders or a path selected through the OS file picker; show candidates when the match is unclear.
- Make multi-step work visible and cancellable, and require fresh confirmation before sending, deleting, purchasing, or sharing data.

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
- Never upload raw behavioral logs. Any future federated update requires explicit opt-in plus a reviewed protocol; calling an update encrypted or private is not a substitute for secure aggregation and a documented privacy guarantee.
- Don't crawl the whole filesystem, inspect unrelated app data, or access credentials. Use the narrowest user-approved file scope needed for the specific command.
- Don't store credentials/secrets (API keys, session tokens) in plaintext config files — use OS credential storage (Windows Credential Manager) where possible.

## Automation & Execution Rules

**Do**
- Prefer Playwright/browser automation over native UI Automation (UIA) wherever a task can be done through a website — it's more stable and maintainable.
- Expose narrow capabilities to the planner; never give model output a generic shell, arbitrary path-read, or unrestricted browser-control tool.
- Log every executed action locally, including failures, for debugging and future prediction-model training.
- Treat WhatsApp Web (or any ToS-restricted) automation as a known risk — document it, don't quietly rely on it as core functionality until the tradeoff is deliberately accepted.

**Don't**
- Don't build per-app UIA scripts unless the app is high-value enough to justify ongoing maintenance (breaks on every UI update).
- Don't chain multi-step automations without a way for the user to see/interrupt what's happening mid-execution, especially once actions get more complex (v3+).
- Don't treat the user's request as blanket permission to transfer every matching file or message; show the exact destination and payload before sensitive actions.

## Development Process Rules

**Do**
- Build and validate the UI/interaction loop with fixture commands before adding more intent complexity — prove the shell works before adding intelligence.
- Prototype parsing against synthetic or explicitly consented development examples. Any cloud provider used during development must be opt-in, clearly disclosed, and must not receive real private commands by default.
- Keep skills as isolated modules with a defined input schema — this is the extensibility mechanism, don't bypass it for "quick" one-off integrations.

**Don't**
- Don't assume a larger local model is needed; benchmark rules and compact local approaches first. Keep the product's local-first default and use synthetic/consented fixtures instead of requiring cloud AI calls during prototyping.
- Don't start the predictive/ML feature before the core on-demand assistant loop (tray → popup → command → execution) is solid — it's a v3 feature, not the foundation.
- Don't lock in a product name, stack detail, or UI polish decision prematurely while still in brainstorming/feasibility stage — confirm big-picture direction before feature-level investment (matches how this project's planning has actually proceeded).
