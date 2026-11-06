# Local Assistant Engine — 02 Scope

**6 Nov 2026** · **@Ved Narvekar**

## Summary

Version 1 supports 49 tasks for everyday personal users, small businesses and startups, on Windows. Every task runs on the device. Tasks that need fresh facts, like weather, use a normal web lookup, never an external AI. Tasks can be chained, like “play my focus playlist and turn on Do Not Disturb.”

**Risk levels used below:**

- **Safe action:** opens or plays something. Nothing is saved or sent.
- **Read only:** looks at data, changes nothing.
- **Changes data:** moves, edits or saves something. Can be undone.
- **Sends or shares:** reaches another person. Always needs a one-tap confirm.

**Target users:** everyday personal users, plus small businesses and startups.

**Apps covered:** WhatsApp, Spotify, YouTube and Chrome, plus both work suites: Google (Gmail, Drive, Calendar) and Microsoft 365 (Outlook, OneDrive, Teams).

## Apps and media

| # | Task | Example request | Risk |
|---|---|---|---|
| A1 | Open or close an app | “Open Spotify.” | Safe action |
| A2 | Play a song, artist or playlist on Spotify | “Play Arijit Singh on Spotify.” | Safe action |
| A3 | Control playback: pause, skip, volume | “Skip this song.” | Safe action |
| A4 | Open a creator's latest YouTube video | “Open [creator]'s latest video on YouTube.” | Safe action |
| A5 | Search YouTube or the web | “Search YouTube for pasta recipes.” | Safe action |
| A6 | Open a website | “Open Amazon.” | Safe action |

## Messaging and chat

| # | Task | Example request | Risk |
|---|---|---|---|
| M1 | Send a WhatsApp message | “Tell Ved on WhatsApp I'm on my way.” | Sends or shares |
| M2 | Send a file on WhatsApp | “Send this file to Ved on WhatsApp.” | Sends or shares |
| M3 | Read my latest messages | “Any new WhatsApp messages?” | Read only |
| M4 | Post in a Teams chat or channel | “Tell the team chat I'm running 10 minutes late.” | Sends or shares |

**Note:** WhatsApp has no official API for personal accounts. The engine drives the WhatsApp desktop app through the accessibility tree.

## Email (Gmail and Outlook)

| # | Task | Example request | Risk |
|---|---|---|---|
| E1 | Show urgent unread emails | “Any urgent emails?” | Read only |
| E2 | Summarize an email or thread | “Summarize this thread.” | Read only |
| E3 | Find emails by person, topic or date | “Find Rahul's emails about the budget.” | Read only |
| E4 | Show emails waiting for my reply | “What haven't I replied to?” | Read only |
| E5 | Draft a reply for review | “Draft a reply saying yes, Friday works.” | Changes data |
| E6 | Archive, move or mark as read | “Archive all newsletters from today.” | Changes data |
| E7 | Send an email, with or without a file | “Email Rahul that the report is ready.” | Sends or shares |

## Quick info

| # | Task | Example request | Risk |
|---|---|---|---|
| Q1 | Moon phases, sunrise and sunset | “When is the next full moon?” | Read only |
| Q2 | Weather | “Will it rain tomorrow?” | Read only |
| Q3 | Quick facts | “What's the capital of Australia?” | Read only |
| Q4 | Math and unit conversions | “What's 18% of 2,450?” | Read only |
| Q5 | Time zones and dates | “What time is it in New York?” | Read only |

**Note:** Q1, Q4 and Q5 are calculated on the device, no internet needed. Q2 and Q3 need a web lookup, because a small local model can't know current facts reliably.

## Files (local, OneDrive and Google Drive)

| # | Task | Example request | Risk |
|---|---|---|---|
| F1 | Find a file by name, type or description | “Find the budget sheet from last week.” | Read only |
| F2 | Show recent files and downloads | “What did I download today?” | Read only |
| F3 | Open a file | “Open the Q3 deck.” | Safe action |
| F4 | Move, rename or copy files | “Move these PDFs to the Invoices folder.” | Changes data |
| F5 | Send a file by email or Teams | “Send this file to Rahul.” | Sends or shares |
| F6 | Share a cloud folder or file link | “Share the project folder with my team.” | Sends or shares |

## Calendar and meetings (Google Calendar and Outlook)

| # | Task | Example request | Risk |
|---|---|---|---|
| C1 | Show today's or this week's schedule | “What's on my calendar today?” | Read only |
| C2 | Find a free slot with specific people | “When are Rahul and I both free this week?” | Read only |
| C3 | Prepare for the next meeting | “Show me the emails and files for my 3pm.” | Read only |
| C4 | Add an event | “Add dentist on Friday at 4pm.” | Changes data |
| C5 | Block focus time | “Block two hours tomorrow morning.” | Changes data |
| C6 | Schedule a meeting and send the invite | “Set up 30 minutes with my team on Thursday.” | Sends or shares |
| C7 | Reschedule or cancel a meeting | “Move my 3pm to tomorrow.” | Sends or shares |
| C8 | Accept or decline an invite | “Decline the Friday review.” | Sends or shares |

## Reminders and timers

| # | Task | Example request | Risk |
|---|---|---|---|
| R1 | Set a reminder | “Remind me to call mom at 6pm.” | Changes data |
| R2 | Set a timer or alarm | “Set a 10-minute timer.” | Changes data |

## Cross-app workflows

| # | Task | Example request | Risk |
|---|---|---|---|
| W1 | Morning brief: urgent emails and today's meetings | “Give me my morning brief.” | Read only |
| W2 | Turn an email into a calendar event | “Add this meeting request to my calendar.” | Changes data |
| W3 | Save email attachments to a cloud folder | “Save these invoices to the Finance folder.” | Changes data |
| W4 | Forward a file from an email to a chat | “Send the attachment from Rahul's email to the project chat.” | Sends or shares |
| W5 | Weekly report: find the latest file and email it | “Send this week's report to my manager.” | Sends or shares |
| W6 | Focus mode: music plus Do Not Disturb | “Play my focus playlist and mute notifications for an hour.” | Changes data |

## System controls

| # | Task | Example request | Risk |
|---|---|---|---|
| S1 | Change volume or brightness | “Turn the volume down.” | Safe action |
| S2 | Lock the screen | “Lock my laptop.” | Safe action |
| S3 | Turn Wi-Fi or Bluetooth on or off | “Turn on Bluetooth.” | Changes data |
| S4 | Turn on Do Not Disturb | “Don't disturb me for an hour.” | Changes data |
| S5 | Take a screenshot | “Take a screenshot.” | Changes data |

## Out of scope for V1

These wait for later versions. Saying no now keeps V1 small enough to finish.

- Other platforms: Mac and Linux.
- Apps beyond the V1 list: Instagram, Telegram, Slack, Zoom and others.
- Permanent deletes of messages, emails, files or events.
- Complex website actions: filling forms or clicking through websites. Opening and searching sites is in scope.
- Screen reading with vision models: V1 uses app APIs and the accessibility tree only.
- Voice input.
- Money and accounts: payments, purchases, account settings.
- Learning features: automatic routine detection and federated learning.
- Cloud AI: no external AI of any kind. Plain web lookups are allowed.
- Languages: English only.

## Open decisions

- 49 tasks is large for V1; mark which are must-haves for launch.
- Support both Google and Microsoft suites in V1, or one first?
- Add Slack, since many startups use it?
- Keep voice input out of V1?
- Keep V1 English only?

Next doc: **03 Requirements.** It defines what each task must do, plus memory, speed, privacy and safety targets.
