# Ve — Product Document

## 1. Vision
Ve is a Jarvis-style personal assistant for Windows desktops/laptops. It lives in the system tray beside the wifi/battery icons — not as a taskbar app — and opens a small chat-style popup on click. Users type or speak instructions, and Ve executes real actions on the machine: opening apps, searching and opening content on websites, sending messages through web interfaces, and more, using learned preferences (e.g. default browser) to act smartly without over-asking.

A secondary, non-core feature is a proactive startup suggestion: on boot, Ve may predict and suggest what the user likely wants to do next, based on learned routine.

## 2. Problem Statement
Existing voice assistants (Siri, Google Assistant, Cortana) are either mobile-first, cloud-locked, or discontinued on Windows. There is no lightweight, privacy-respecting, action-executing assistant that lives natively in the Windows tray and can be extended with new skills over time.

## 3. Target User
- Primary: the builder (Ved), power users comfortable with technical tools who want a fast, low-friction way to trigger multi-step actions without opening apps manually.
- Not targeting: non-technical mass-market users in v1. No enterprise/compliance requirements in v1.

## 4. Core Principles
- **Privacy-first**: raw logs and actions stay on-device by default. Cloud calls (LLM API) are opt-in/explicit, not silent.
- **Low friction**: every interaction should be fewer clicks/keystrokes than doing the task manually — otherwise the feature has failed its purpose.
- **Ambient, not intrusive**: Ve should feel like system infrastructure (tray icon), not another app window competing for attention.
- **Fail visibly, not silently**: if Ve can't complete an action, it says so and offers an alternative — it never pretends to succeed.

## 5. Feature Set

### 5.1 MVP (v1) — must have
- Tray icon with custom popup (positioned near system tray, chat-style UI)
- Text input bar for typed instructions
- Chat-style message history within a session
- Command routing for a fixed set of actions: open app, open URL, web search
- Smart default: remembers and uses preferred browser without being told each time
- Basic error/failure feedback when a command can't be executed

### 5.2 V2 — should have
- Voice input (mic button, local speech-to-text)
- LLM-based free-text intent parsing (replacing rigid command matching)
- Browser automation for content lookup + open (e.g. "open Walking Dead on Netflix in Chrome")
- Persistent local storage of preferences and command history (SQLite)

### 5.3 V3 — nice to have
- Predictive startup suggestion popup (learns time/day/app-sequence patterns, suggests 1-click actions on boot)
- Native app automation for specific high-value apps (e.g. WhatsApp Desktop) via Windows UI Automation, OR browser-based automation of WhatsApp Web as the more stable alternative
- Skill plugin system so new capabilities can be added without touching core app
- Local LLM option (Ollama + small model) as a fully offline alternative to cloud API

### 5.4 Explicitly out of scope (for now)
- Fully general "control any app" agentic reasoning — unsolved problem, not an MVP goal
- Mobile app / cross-device sync
- Multi-user / enterprise features
- Federated learning across devices

## 6. Success Criteria (MVP)
- Ve can open at least 5 different categories of things (apps, URLs, web search, and 2 more) correctly >90% of the time on the builder's own machine
- Time from "click tray icon" to "action executed" is under the time it'd take to do it manually
- No raw personal data leaves the device without an explicit, visible action (e.g. calling a cloud LLM)

## 7. Open Questions (unresolved, revisit later)
- Final product name
- Cloud LLM provider choice for intent parsing prototype
- Whether WhatsApp automation is worth the ToS/account-risk tradeoff, or should be dropped entirely
- Distribution: personal use only, or eventually packaged for others?