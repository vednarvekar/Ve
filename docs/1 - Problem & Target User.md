# Local Assistant Engine — 01 Problem & Target User

**6 Nov 2026** · **@Ved Narvekar**

## Problem

People lose hours every day on repetitive computer work. They click through many screens, switch between apps, and read long emails just to find what matters.

- Sorting and replying to email
- Finding a file and sending it to someone
- Scheduling meetings and checking calendars
- Repeating the same multi-app steps every week

## Vision

A private AI helper on every laptop that does boring computer work in seconds. It runs fully on the device, even on an 8GB laptop, with no external AI calls.

## First customer

Office workers at small and mid-size companies, on Windows, using Microsoft 365 (Outlook, Teams, OneDrive). This is the starting group. The long-term goal is everyone who uses a laptop or desktop.

**Why start here:**

- One app suite means fewer connectors to build.
- They face all four V1 pains every day.
- Companies pay for productivity tools.
- A fully local, private assistant matters most to businesses.

## Pains for V1

Version 1 covers four pain areas. Each gets 5–8 exact tasks in the Scope doc.

| Pain area | Example request |
|---|---|
| Email triage and replies | “Show me urgent emails and draft replies.” |
| Finding and sharing files | “Send this file to Rahul.” |
| Calendar and meetings | “Find 30 minutes with my team this week.” |
| Repetitive cross-app workflows | “Export the weekly report and email it to my manager.” |

## Constraints

- **Hardware:** 8GB RAM minimum. Engine peak memory stays under 2GB.
- **Platform:** Windows first, Mac next.
- **Design:** The core engine is cross-platform. OS-specific code lives in a separate adapter layer, so Mac support means a new adapter, not a rewrite.
- **Privacy:** Fully local by default. No external AI calls.

## Open decisions

- Confirm the first customer group.
- Confirm Microsoft 365 as the V1 app suite.

Next doc: **02 Scope.** It picks the exact 20–30 V1 tasks, about 5–8 per pain area, plus what V1 will not do.
