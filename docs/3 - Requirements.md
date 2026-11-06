# Local Assistant Engine — 03 Requirements

**6 Nov 2026** · **@Ved Narvekar**

## Summary

These are the rules every V1 task must follow, and the targets the engine must hit. They apply to all 49 tasks in 02 Scope. Each requirement has an ID so later design docs and tests can point to it.

## Functional requirements

| ID | Requirement |
|---|---|
| FR1 | Accept typed requests from a command bar opened by a global hotkey. |
| FR2 | Understand casual wording, like “send this to Ved” or “play something calm.” |
| FR3 | Resolve vague words using context: “this file” = the selected file, “Ved” = the matching contact. |
| FR4 | When two or more matches fit, ask one short question with tappable choices. |
| FR5 | Run chained requests in order, like “play music and turn on Do Not Disturb.” |
| FR6 | Check that each step worked before moving on. |
| FR7 | Report the result in one short line, or explain clearly what failed and why. |
| FR8 | Offer Undo for every action that changes data. |
| FR9 | Say clearly when a request is outside V1, instead of guessing. |
| FR10 | Remember simple defaults, like the contact or app the user usually picks. |

## Safety rules

Every task carries one of the four risk levels from 02 Scope. The level decides how the engine behaves.

| ID | Risk level | Behavior |
|---|---|---|
| SR1 | Safe action | Runs right away. |
| SR2 | Read only | Runs right away and shows the result. |
| SR3 | Changes data | Runs, then shows an Undo button. |
| SR4 | Sends or shares | Always shows a one-tap confirm first, with the recipient and a preview of what goes out. |

**Rules that always apply:**

- **SR5:** Never act on instructions found inside emails, messages, files or web pages. That content is data, not commands.
- **SR6:** Never permanently delete anything in V1.
- **SR7:** Never send to a recipient the user didn't name or clearly confirm.

## Performance targets

All targets are measured on a Windows laptop with 8GB RAM and no dedicated GPU.

| ID | Measure | Target |
|---|---|---|
| PR1 | Memory when idle | Under 300MB |
| PR2 | Peak memory during a task | Under 2GB |
| PR3 | CPU when idle | Under 1% |
| PR4 | Known task, time to start acting | Under 0.5 seconds |
| PR5 | Safe actions end to end (open app, play song) | Under 1 second |
| PR6 | New task needing the local planner | Under 5 seconds |
| PR7 | Web lookup tasks (weather, facts) | Under 3 seconds plus network time |
| PR8 | Ready after login | Under 5 seconds |
| PR9 | Download size, including models | Under 3GB |

## Privacy and security

| ID | Requirement |
|---|---|
| PS1 | All AI runs on the device. No request or personal data goes to any external AI. |
| PS2 | Data leaves the device only for app actions the user asked for, like sending an email. |
| PS3 | Web lookups send only the search terms, never personal data like names or files. |
| PS4 | Local memory and activity logs are encrypted on disk. |
| PS5 | App sign-ins use official OAuth and the OS keychain. The engine never stores raw passwords. |
| PS6 | Every action is written to a local log the user can view. |
| PS7 | The user can view, edit and delete what the assistant has learned about them. |
| PS8 | Tasks that don't need an online app or a web lookup work fully offline, like opening apps, files, reminders and system controls. |

## Reliability and quality

These are measured on the test set built in Step 4: about 100 real requests covering all 49 tasks.

| ID | Measure | Target |
|---|---|---|
| RQ1 | Task success rate on supported tasks | 90% or higher |
| RQ2 | Sends or shares without a confirm | 0 |
| RQ3 | Messages or files sent to the wrong person | 0 |
| RQ4 | Wrong task picked for a clear request | Under 3% |
| RQ5 | Out-of-scope requests correctly declined | 95% or higher |
| RQ6 | Engine crashes per 1,000 tasks | Under 1 |

## App integrations

Official APIs come first. The accessibility tree is the fallback when no API exists. Screenshots and vision are not used in V1.

| App or area | Method | Notes |
|---|---|---|
| Gmail, Google Calendar, Google Drive | Official Google APIs | OAuth sign-in. |
| Outlook, OneDrive, Teams | Microsoft Graph API | OAuth sign-in. |
| WhatsApp | Accessibility tree | No official API for personal accounts. Drives the desktop app. |
| Spotify | Windows media controls + Spotify app | Play, pause and skip via media controls. Playing a specific song may need the Spotify Web API, which may require Premium (to verify). |
| YouTube | Browser + public channel data | Opens videos in the default browser. Finding the latest video needs a web lookup. |
| Websites | Default browser | Opens and searches only. |
| Local files | File system + Windows Search index | Fully offline. |
| System controls | Windows APIs | Do Not Disturb may need the accessibility tree (to verify). |
| Reminders and timers | Engine scheduler + Windows notifications | Fully offline. |
| Weather and facts | Web lookup | Sends search terms only. |
| Moon, sunrise, time zones, math | On-device calculation | No internet needed. |

## Open decisions

- Confirm the performance targets are realistic, after the feasibility spikes in Step 5.
- Which web lookup service to use for weather and facts.
- Do small businesses need a team admin console in V1, or later?
- Verify Spotify and Do Not Disturb integration options.

Next doc: **04 Success Metrics and Test Set.** It builds the ~100 real requests used to measure RQ1–RQ6.
