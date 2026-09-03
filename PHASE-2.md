# Phase 2 — Skill Router + React Renderer

## What changed from Phase 1

1. **Skill router architecture** (per phases.md Phase 2)
   - `src/core/models/commandSchema.ts` — the `Command` / `Skill` / `SkillResult` contract
   - `src/core/skillRouter.ts` — dispatches a `Command` to the right skill; this one file's
     registry map is the entire extensibility point going forward
   - `src/skills/openApp/`, `src/skills/openUrl/`, `src/skills/webSearch/` — each is now
     an isolated module implementing the `Skill` interface, not lines in a big if/else chain
   - `src/main/commandParser.ts` replaces Phase 1's `commandHandler.ts` — its *only* job is
     turning raw text into a `Command`. It never executes anything. This split is what lets
     Phase 3 swap this file for an LLM parser without touching the router or any skill.

2. **React + Vite renderer** (replaces Phase 1's vanilla HTML/TS)
   - `src/renderer/` is now a proper component tree: `App.tsx`, `ChatView.tsx`,
     `MessageBubble.tsx`, `InputBar.tsx`, `MicButton.tsx`, plus a `useChat` hook holding
     message state and the IPC call.
   - Built with **Vite**, not raw `tsc` + a copy script — Vite bundles the HTML/CSS/TSX
     together automatically, which is also why `copy-assets.js` shrank to just the tray
     icon PNGs now.
   - **Fixed the overlapping/disappearing input bar bug from your local testing.** Root
     cause: the scrollable `.messages` container had `flex: 1` but no `min-height: 0`.
     Flex items default to `min-height: auto` ("don't shrink below your content"), so once
     the chat history got tall enough, the messages div pushed past the popup's height and
     shoved the input bar off-screen instead of scrolling internally. Added `min-height: 0`
     on `.messages` and `flex-shrink: 0` on `.input-bar` — see the comment block in
     `styles.css` right above `.messages` for the full explanation.

## Build & run (Windows)

```
npm install
npm start
```

`npm start` now runs a two-step build — `tsc` compiles `main/`, `preload/`, `core/`,
`skills/`; `vite build` compiles the React renderer — before launching Electron.

Same test commands as Phase 1 still work identically from the user's side:
`open chrome`, `open notepad`, `open https://github.com`, `search cats`, `go to reddit.com`
— but now every one of those routes through the skill registry instead of a single
hardcoded handler function.

## File map additions

```
src/
├── core/
│   ├── models/commandSchema.ts   # Command / Skill / SkillResult types
│   └── skillRouter.ts             # registry + dispatch
├── skills/
│   ├── openApp/index.ts
│   ├── openUrl/index.ts
│   └── webSearch/index.ts         # composes openUrl rather than duplicating logic
├── main/
│   └── commandParser.ts           # text -> Command (hardcoded; Phase 3 = LLM here)
└── renderer/                      # now Vite + React
    ├── main.tsx
    ├── App.tsx
    ├── styles.css
    ├── global.d.ts
    ├── components/
    │   ├── ChatView.tsx
    │   ├── MessageBubble.tsx
    │   ├── InputBar.tsx
    │   └── MicButton.tsx
    └── hooks/useChat.ts
```

## Next: Phase 3

Per phases.md — swap `commandParser.ts`'s hardcoded matching for a cloud LLM call.
Nothing in `skillRouter.ts` or any skill module needs to change; the parser still just
needs to return a `Command` object, however it decides what that command is.