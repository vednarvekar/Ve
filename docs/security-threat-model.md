# Ve security threat model

**Status:** Initial implementation threat model for roadmap Step 2.1. This records the current desktop prototype and its limits; it is not a claim that Ve is foolproof.

## Assets and impact

| Asset | Why it matters | Current exposure |
|---|---|---|
| Contact names and phone numbers | Personal data usable for unwanted contact or impersonation | SQLite; chat renderer can list, add, and delete through dedicated IPC |
| User memories/notes | May contain sensitive personal context | SQLite; chat renderer can list, add, and delete through dedicated IPC |
| Behavior events and local model weights | Reveal usage patterns and personalization state | SQLite/local model files; chat can read a count and clear this data; new writes/suggestions are disabled |
| Browser and app sessions | May provide access to signed-in services and private content | Ve can open a browser URL or a known app; Ve does not read browser profiles, cookies, or credentials |
| User files | May contain confidential documents and images | Ve currently has no renderer file-read/search IPC and no general file broker |
| User identity and desktop session | Actions happen as the logged-in OS user | Ve runs with the user's ordinary process privileges; it does not request elevation |
| Command intent | Can cause app launch or open a website | Chat input enters the local parser and registered skill router; no generic shell or model-selected executable path is exposed |

## Trust boundaries and abuse cases

| Boundary / attacker-controlled input | Abuse case | Current control | Remaining limit / follow-up |
|---|---|---|---|
| Chat, orb, and menu renderer → Electron main IPC | A compromised launcher page requests contacts, memories, or a command | Exact local main-frame URL check plus a per-channel renderer-role allowlist | A compromised chat renderer retains the chat UI's granted capabilities. Step 2.2 must enforce typed capability policy and confirmations in main |
| User text → local intent model → skill router | Prompt-like text tries to turn into a shell command, path, or unknown skill | Model output is used as a registered skill ID and validated params; unknown skills fail; app launch uses fixed aliases and argument arrays; browser URLs are scheme-validated | Current app aliases are static and narrow; dynamic discovery is later work. Keep new skills behind schemas and policy tests |
| Web content / external provider destination → system browser | A malicious or malformed URL attempts a local protocol or script URL | Browser skill allows only supported HTTP(S) navigation and constructs provider searches itself | Opening a legitimate HTTPS page may still expose data already available in the user's browser session; Ve does not inspect that session |
| SQLite and local files → renderer/model | A compromised UI or model tries to read unrelated files or credentials | No general filesystem or credential API is bridged; sensitive IPC is restricted to chat | Chat can access its documented contacts/memories. OS-level malware running as the user can read Ve's data regardless of Ve IPC policy |
| Ve process → OS application launcher | Input injects shell metacharacters or launches an arbitrary executable | Current app targets resolve through a fixed alias table; `spawn` receives separate arguments; unknown targets fail | The current alias catalog is not dynamic and is not a provenance-verified installed-app catalog |
| Renderer → persistent local state | A compromised UI clears behavior state or changes contacts/memories | Main validates bounded strings and IDs; these channels are chat-only | Main-process confirmation for destructive or externally visible actions is not implemented yet; see Step 2.2 |

## Renderer IPC capability policy

Main process is the authorization point. Every exposed renderer-to-main IPC channel must appear in `app/main/rendererCapabilityPolicy.ts`; an unlisted channel fails closed during registration.

| Channel | Allowed role | Operation and data | Risk / boundary |
|---|---|---|---|
| `ve:run-command` | Chat | Parse user text and route to registered local skills | Can launch allowlisted apps or open validated web destinations; no arbitrary command/path |
| `ve:list-memories`, `ve:add-memory`, `ve:delete-memory` | Chat | Read and edit saved user notes | Personal data; bounded text and ID validation |
| `ve:list-contacts`, `ve:add-contact`, `ve:delete-contact` | Chat | Read and edit contact names/phone numbers | Personal data; bounded fields and ID validation |
| `ve:get-prediction-state` | Chat | Return behavior-event count and empty suggestions | Does not return the event contents |
| `ve:clear-behavior` | Chat | Delete behavior events and local model state | Destructive; main-process confirmation remains Step 2.2 work |
| `ve:show-orb` | Chat | Restore the floating launcher and hide chat window | UI lifecycle only |
| `ve:orb-menu-visible` | Orb, Menu | Show or dismiss the launcher menu | Boolean input validation; UI lifecycle only |
| `ve:orb-open-chat`, `ve:orb-hide` | Menu | Open the chat window or hide launcher | UI lifecycle only |
| `ve:orb-get-position`, `ve:orb-move`, `ve:orb-save-position` | Orb, Menu | Read, clamp, and save launcher position | Coordinates are finite and clamped to visible display bounds |
| `ve:orb-drag-position`, `ve:orb-drag-finish` | Orb | Move the launcher during a pointer drag | One-way IPC; coordinates are bounded and frame-checked |

The allowlist narrows which renderer window may reach each IPC handler. It does not distinguish a genuine user click from script executing inside an already trusted renderer; renderer isolation, input validation, main-process capability policy, and confirmations are separate controls.

## Explicit prohibitions

- No arbitrary shell, PowerShell, `eval`, or model-selected executable path.
- No admin elevation, broad filesystem crawl, credential-store access, or browser-profile inspection.
- No reading file contents through renderer IPC. File search requires a future scoped file broker and explicit approved roots.
- No silent external message or file transfer. WhatsApp support currently opens a user handoff; the user reviews and sends.
- No automatic model authority: model output can select only registered, schema-validated skills, and future policy decisions must be recomputed in main.
- No claim of foolproof protection against malware or an attacker controlling the same OS account. Ve should limit its additional authority and make abuse visible.

## Verification

`tests/unit/renderer-capability-policy.unit.test.mjs` checks that every preload channel and every main handler has a declared policy, that roles are separated, that unknown channels fail closed, and that a menu frame cannot invoke the chat command handler. `tests/unit/ipc-security.unit.test.mjs` covers untrusted frames and malformed strings. These tests verify the IPC boundary only; they do not prove resistance to a compromised chat renderer, compromised OS account, Electron/runtime exploit, or malicious installed application.

**Next security work:** Step 2.2 defines typed capability contracts and main-enforced confirmations. File access, dynamic app discovery, external messaging, and voice remain disabled or narrowly scoped until their own policy and tests exist.
