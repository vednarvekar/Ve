# Local Assistant Engine — 05 Feasibility Spikes

**6 Nov 2026** · **@Ved Narvekar**

## Summary

Ten small prototypes test the riskiest ideas before any full design. They take about 5 weeks with 2–3 engineers.

A spike is quick, throwaway code that answers one question with real numbers. If a spike fails, the plan changes now, while it's cheap. The results also confirm or adjust the targets in 03 Requirements.

## Spikes

All spikes run on the 8GB test laptop from 04, with Chrome and a chat app open, like a real user.

| ID | Risk being tested | Pass if | If it fails |
|---|---|---|---|
| SP1 | Can a tiny router pick the right task? | 85%+ correct on single-task requests, scored on a held-out test set never used for training or tuning. Chained requests are reported separately. Under 50ms, under 150MB | Add more training data, or use a slightly bigger encoder |
| SP2 | Can a tiny model pull out names, files and times from casual wording? | 95%+ correct on T01–T64 | Add rules for common patterns, or a bigger extractor |
| SP3 | Can a 1–3B local model plan chained tasks on a CPU? | Correct plans for T75–T82, under 5 seconds, under 2GB | Cover chains with fixed templates; send rare cases to a “can't do that yet” prompt |
| SP4 | Can adapters swap fast on a CPU? | Swap under 200ms, memory stays flat | Keep a few separate small models instead |
| SP5 | Can the engine drive WhatsApp desktop reliably? | 20 of 20 messages and files sent correctly | Open WhatsApp at the right chat and let the user press Send |
| SP6 | Can the engine play a specific song without Spotify Premium? | Requested song plays in 9 of 10 tries | Open Spotify search results and let the user tap Play |
| SP7 | Can the engine toggle Do Not Disturb on Windows 11? | Works 10 of 10 times | Mute notifications per app instead |
| SP8 | Does the whole pipeline stay in budget? | Idle under 300MB, peak under 2GB, known tasks under 0.5s | Shrink models, or raise the minimum to 12GB |
| SP9 | Can trick instructions in emails and pages be blocked? | T91–T93 all pass | Stricter separation of content and commands |
| SP10 | Does the install fit the size budget? | Under 3GB with all models | Download models on first use |

## Order and team

Two engineers work in parallel. The end-to-end checks come last, because they need the other parts.

- **ML engineer:** SP1, SP2, SP3, SP4, SP9
- **Windows and integrations engineer:** SP5, SP6, SP7, then the legal checks
- **Both together:** SP8, SP10

1. **Weeks 1–2:** SP1 and SP2 (models). SP5, SP6 and SP7 (apps). These are the biggest unknowns, so they go first.
2. **Weeks 3–4:** SP3, SP4 and SP9 (planner, adapters, safety). Legal checks run alongside.
3. **Week 5:** SP8 and SP10. The parts are joined into one rough pipeline and measured on the 8GB laptop.

## Legal and platform checks

These can block a launch even if the tech works, so they run alongside the spikes. Each needs a careful read of the current terms, ideally with a lawyer.

| Check | Why it matters |
|---|---|
| WhatsApp terms on automation | WhatsApp's terms limit automated use. Driving the desktop app may break them, even for single messages the user asked for. |
| Spotify and YouTube terms | Automating their apps or pages may conflict with their rules. |
| Google API verification | Access to Gmail and Drive may require Google app verification and possibly a third-party security review (to verify). This can take weeks and cost money. |
| Microsoft app registration | Graph access for Outlook, OneDrive and Teams needs a registered app and admin consent in some company accounts. |
| Privacy law | Rules like GDPR and India's DPDP Act apply to activity logs and learned habits, even when stored only on the device. |

## What each spike delivers

Each spike ends with a one-page result, added as a row in a results log. It holds:

- **Verdict:** pass, fail, or pass with changes.
- **Numbers:** accuracy, speed and memory, measured on the test laptop.
- **Decision:** keep the plan, switch to the fallback, or change a target in 03.
- **Code:** kept in a spikes folder for reference. It is not used in the real product.

## Open decisions

- [ ] Who are the two engineers for the spikes?
- [ ] Which small encoder and which 1–3B model to try first?
- [ ] If WhatsApp automation breaks its terms, keep WhatsApp with the “user presses Send” fallback, or drop it from V1?
- [ ] Book a lawyer review of the legal checks.

**Next doc:** 06 High-Level Design (HLD). Written after the spikes, using their results.
