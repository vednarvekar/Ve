# Ve — Product Document

## 1. Vision
Ve is a personal desktop assistant for Windows that executes real actions from typed or spoken requests — opening apps, finding and opening content on websites, sending messages, and more. It lives in the system tray beside the wifi/battery icons, not as a taskbar app, and opens a small chat-style popup on click.

**The core differentiator is federated learning.** Most assistants that "learn you" do it by sending behavioral data to a server. Ve is built to learn a user's routines and preferences (app usage patterns, common requests, timing) entirely on-device, and improve over time by sharing only encrypted/aggregated model updates — never raw personal data — across users. The action-execution layer (tray, chat, skills) is the interface; the FL-based learning layer is the actual point of the project.

A proactive startup suggestion (predicting what the user wants on boot) is the first user-visible feature built on top of this learning layer, but the learning system itself — local training + federated aggregation — is the long-term goal, not a nice-to-have.

## 2. Problem Statement
Existing voice assistants (Siri, Google Assistant, Cortana) are either mobile-first, cloud-locked, or discontinued on Windows. Assistants that do personalize typically do so by centralizing user data on a server. There's no lightweight, action-executing Windows assistant that learns and personalizes through on-device training and federated learning instead of centralized data collection.

## 3. Target User
- Primary: the builder (Ved), power users comfortable with technical tools who want a fast, low-friction way to trigger multi-step actions without opening apps manually.
- Not targeting: non-technical mass-market users in v1. No enterprise/compliance requirements in v1.

## 4. Core Principles
- **On-device learning, federated improvement**: raw behavioral data (app usage, command history) never leaves the device. The model learns locally; only encrypted/aggregated updates are ever shared, and only once federated learning is implemented (v3+) — never raw logs.
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
- Local prediction: learns time/day/app-sequence patterns on-device, powers the startup suggestion popup
- Native app automation for specific high-value apps (e.g. WhatsApp Desktop) via Windows UI Automation, OR browser-based automation of WhatsApp Web as the more stable alternative
- Skill plugin system so new capabilities can be added without touching core app
- Multi-provider support: user configures their own API key (Anthropic, Gemini, or OpenAI); intent parsing always uses the cheapest model available, complex tasks use a smarter model only when needed

### 5.4 V4 — core long-term goal
- **Federated learning**: local models train on-device, then share only encrypted/aggregated model updates (never raw logs) to a central aggregator, which redistributes an improved global model back to all users
- Cross-user pattern generalization without any single user's raw data ever leaving their machine
- This is the feature the project exists to prove out — everything before it (tray shell, skills, local prediction) is the substrate FL needs to run on top of

### 5.5 Explicitly out of scope (for now)
- Fully general "control any app" agentic reasoning — unsolved problem, not an MVP goal
- Mobile app / cross-device sync
- Multi-user / enterprise features

## 6. Success Criteria (MVP)
- Ve can open at least 5 different categories of things (apps, URLs, web search, and 2 more) correctly >90% of the time on the builder's own machine
- Time from "click tray icon" to "action executed" is under the time it'd take to do it manually
- No raw personal data leaves the device without an explicit, visible action (e.g. calling a cloud LLM)

## 7. Open Questions (unresolved, revisit later)
- Final product name
- Cloud LLM provider choice for intent parsing prototype
- Whether WhatsApp automation is worth the ToS/account-risk tradeoff, or should be dropped entirely
- Distribution: personal use only, or eventually packaged for others?