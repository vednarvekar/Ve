# Ve — Product and System Requirements

**Status:** Working requirements for the first build plan. These describe intended behavior, not current implementation. The [roadmap](roadmap.md) turns them into sequenced delivery steps.

## 1. Product goal

Ve is a lightweight, local-first desktop assistant. A user describes a goal in ordinary language; Ve identifies the intended task, discovers the relevant installed app, user-scoped file, or online source, plans a bounded set of operations, executes them through registered capabilities, and reports the result.

Examples:

- “Open The Mentalist” → look up current streaming availability, show/choose a valid result if ambiguous, then open it in the selected installed app or website.
- “Play music on Spotify” → find Spotify dynamically, and use a supported Spotify integration or URL to search/play as authorized.
- “Open the PDF about taxes from my downloads” → search the approved Downloads scope, present ambiguous matches, then open the chosen file with its OS-associated app.
- “Send this file to Ved on WhatsApp” → identify one file and contact, show both, open the official chat where supported, and let the user attach/review/send unless a supported personal-account integration is verified.

The Jarvis comparison is an experience metaphor. It is not a requirement for unrestricted control of every application or a promise that any task can be automated.

## 2. Architecture decision: models assist; the system executes

Ve must not depend on a tiny language model to solve every part of every task. Small models can be useful for local intent classification, entity extraction, paraphrase handling, and selecting among a small set of registered capabilities. They can still misunderstand requests, emit invalid parameters, or fail on long multi-step workflows.

The system should therefore split work by strength:

1. **Language interface:** deterministic rules for obvious common commands; a compact local model may interpret ambiguous phrasing and produce a typed goal/plan proposal.
2. **Resource discovery:** OS app catalogs, approved-folder file search, and explicit online catalog/search sources provide current candidates. Do not ask a model to recall which app is installed or where a changing streaming catalog carries a show.
3. **Planning and execution:** a deterministic workflow engine checks that each proposed operation is registered, authorized, valid, and possible. It owns progress, cancellation, timeouts, retries, and state transitions.
4. **Integrations:** OS APIs, documented service APIs, URI protocols, or isolated app adapters perform specific operations. Each returns structured evidence/results.
5. **Policy:** main-process code independently enforces permissions and confirmation. Model confidence and prompt instructions are never security controls.
6. **Response:** summarize verified outcomes, distinguish completed from partial/failed steps, and ask the user when a decision or approval is needed.

For the initial local-only product, do not make a cloud LLM a requirement. If a future optional stronger-model fallback is considered, it needs explicit per-task opt-in, disclosed data transfer, a user-supplied or otherwise transparent cost model, and a local-only path that still works without it.

## 3. Capability levels

“No hardcoded apps” means the core parser and launcher do not contain a fixed app-name switch. It does not mean every app exposes a universal way to automate its internal features.

| Level | Capability | Approach |
|---|---|---|
| A | Discover and launch an installed app | Runtime OS app catalog; normalized names/aliases; safe OS launch mechanism; verify the resolved target |
| B | Open a file, URL, or media item in its associated app | OS file associations and URI protocols; resolve a concrete target first |
| C | Search/query an app or service | Documented local protocol or service API, with user authorization where required |
| D | Perform a workflow inside a specific app | Narrow, separately maintained adapter; documented API preferred; constrained UI automation only when justified |
| E | Unsupported app/task | Say what is unsupported, offer a safe fallback, or ask the user to choose |

Installed-app discovery and generic launch should work for apps unknown to Ve. Internal actions such as selecting a show, controlling playback, composing a message, or attaching a file require a supported integration and cannot be promised generically.

## 4. Functional requirements

### FR-1: Understand and represent a goal

- Accept typed natural-language requests first; add voice as a later input adapter that follows FR-10.
- Convert a request into a versioned typed goal with intent, entities, candidate resources, and requested side effects.
- Support clarification when multiple apps/files/people/items match or the command lacks required information.
- Keep the model's output limited to registered capability IDs and schema-bound parameters.
- Preserve the user's original task constraints through the complete workflow; do not silently substitute a different item or recipient.

### FR-10: Accept voice commands privately

- Voice uses explicit push-to-talk. Do not keep the microphone open in the background or add a wake word in the MVP.
- Request microphone permission when the user starts voice capture. Show a clear recording indicator and a cancel action; stop capture immediately on release, cancel, or completion.
- Transcribe locally. Do not upload audio or transcript to a speech service, and do not save raw audio by default.
- Put the transcript into the editable chat composer. The user reviews it and presses Send; transcription alone never executes an action.
- Send approved text through the same parser, capability validation, and policy path as typed commands.
- First benchmark language: English (selected 2026-10-29). Initial engine candidate: `sherpa-onnx-node` with the streaming Zipformer English 20M model in int8. The documented int8 encoder/decoder/joiner files total about 43.6 MB, and sherpa documents microphone streaming and Node.js bindings. This model is English-only, trained on LibriSpeech, and sherpa warns small Zipformer models can have lower accuracy. This is a benchmark candidate, not a final selection; see the [voice runtime evaluation](voice-runtime-evaluation.md).
- Benchmark against Whisper tiny.en and suitable Vosk English models on consented short Ve commands, including the user's ordinary English accent, app/product names, and room noise. Record word error rate, correct-intent/slot rate, latency, RAM/CPU, model size, and native packaging on Windows x64 and Linux x64. WSL results do not substitute for either native target.
- Do not ship a model until its individual model license and redistribution terms are checked. Text-to-speech is outside this input requirement.

### FR-9: Provide the movable desktop launcher as Ve's primary interaction

- Ve's running desktop experience must show a floating Ve mark/orb that the user can move freely within the usable display area and position near their preferred screen edge. This is a core product requirement, not an optional shell mode.
- The system tray remains available as Ve's background/minimized state and restore path; it does not replace the floating launcher in the normal active state.
- Clicking the orb opens a compact action menu with clearly labeled Chat, Voice, and Hide/Minimize-to-tray actions. Voice remains visibly disabled with an explanation until a voice implementation exists.
- Distinguish a click from a drag using a movement threshold so repositioning does not accidentally open the menu. Clamp the orb to visible work areas and handle monitor removal, resolution changes, and DPI scaling.
- Save placement locally. When Ve starts normally, show the orb; when the user hides it to the tray, keep Ve running and let the tray icon or hotkey restore the orb. Do not interpret hide/minimize as Quit.
- Keep the orb above ordinary windows while enabled, but provide immediate hide/minimize and a tray/hotkey recovery path. It must not capture screen content or gain additional file/app permissions merely by being an overlay.
- Provide keyboard access, visible focus, accessible names/tooltips, high-contrast states, and reduced-motion behavior; don't make dragging the only way to use or reposition it.
- Avoid stealing focus until the user opens the menu/chat. Ensure minimize returns the launcher to the tray rather than exiting the assistant.

### FR-2: Discover apps dynamically

- Query supported operating-system catalogs at runtime; do not depend on an app list hardcoded into the language parser.
- Resolve aliases, display names, duplicate entries, package identity, and launch target separately.
- Treat user-writable shortcuts, unknown launch targets, and catalog results as untrusted; expose provenance and require deliberate selection/approval where risk warrants.
- Launch without shell-string interpolation and report missing/ambiguous apps clearly.
- Maintain platform adapters; select and document the initial supported OS before platform-specific implementation.

### FR-3: Find and open local files safely

- Default to filename and metadata search in user-approved roots (for example Downloads/Documents) or paths selected with the native file picker.
- Require a separate opt-in before indexing file contents or adding more folders.
- Return a shortlist and require user selection for ambiguous matches.
- Open through the OS association mechanism; never treat a model-provided path as authorized.
- Enforce canonical-path/root checks, symlink and reparse-point policy, file-type handling, size/time limits, and revocation of folder access.
- Keep file contents and sensitive paths out of telemetry, model input, and behavior learning unless the user explicitly requests a specific content operation.

### FR-4: Perform online discovery and service-specific tasks

- Clearly identify when a task needs an internet lookup; local command understanding should not itself require a network call.
- Use named providers/catalogs for current facts such as streaming availability; retain source and timestamp and handle regional/account availability.
- Allow the user to select among matches; never infer playback availability solely from model knowledge.
- Keep a connector boundary for services (for example Spotify). Document required auth scopes, account/plan requirements, developer policy, data returned, and supported operations before implementation.
- If no supported integration exists, open the service/app at a relevant safe destination or explain that Ve cannot finish the in-app action.

#### Connector findings (checked 2026-10-24)

- **Streaming availability:** TMDB has TV/movie watch-provider endpoints backed by JustWatch, with country-specific availability. The endpoint does not provide full provider deep links; it returns a TMDB URL that can lead to the actual content links. JustWatch attribution is required. TMDB says its developer API is free for non-commercial use with attribution; commercial use requires a separate license. Treat it as a candidate provider, not a committed dependency, and verify current terms before release. If using it, ask for or configure the user's country; don't assume the catalog is globally accurate. Display the source and offer a provider-level search/open fallback when an exact deep link is unavailable.
- **Spotify:** The Spotify Web API can search the catalog and control playback, but calls require OAuth. Use Authorization Code with PKCE for a desktop client, request only necessary scopes, and store/refresh tokens securely. Starting playback requires Premium. As checked on 2026-10-24, Development Mode requires the app owner to have Premium and permits five authorized users; Spotify's July 2026 update raised the developer Client ID allowance to 25 with shared account quota. API access remains a restricted development mode, so recheck eligibility and endpoint access before implementation. Spotify prohibits using its platform/content to train ML/AI and says its platform cannot be used for commercial streaming integrations. A low-friction MVP can open Spotify or a Spotify URI/search destination; automatic playback is a separate opt-in connector with account, device, scope, and policy checks.
- **Cost boundary:** Avoiding AI API calls does not mean all discovery is offline or every external connector is free. Catalog lookups still send a search request to that provider; API quotas, licensing, account plans, and Internet availability must be made visible and budgeted.

### FR-5: Execute multi-step work reliably

- Represent tasks as a bounded DAG/state machine with preconditions, outputs, timeouts, cancellation, and clear user-visible steps.
- Validate every step before execution; re-check state after actions rather than assuming success.
- Limit retries; make retries idempotent where possible and do not repeat external side effects automatically.
- Stop when prerequisites fail, the target changes, confidence is inadequate, or an approval is declined.
- Support partial completion and recovery without replaying already completed messages/transfers.

### FR-6: Communicate or transfer data safely

- Resolve recipients only from user-managed contacts or an explicit picker; handle duplicate names by asking.
- Bind a short-lived, one-use approval to the exact recipient/account, destination, message, file path and file identity/hash, and operation.
- Reconfirm if any bound parameter changes. Rejection, timeout, cancellation, or an integration error must not send.
- Prefer supported, documented service APIs. Evaluate terms, account eligibility, onboarding, and fees before committing to a messaging connector.
- Keep message bodies, credentials, and file contents out of routine logs and learning data.
- **WhatsApp personal account:** Official click-to-chat (`wa.me`) can open a conversation and prefill text; official desktop guidance supports users manually choosing/attaching files in a chat. The official Cloud API is for businesses messaging customers, with policy windows/templates and message pricing; it is not a general API for a personal assistant to message a user's personal contacts. Do not automate a personal account through browser internals or unsupported reverse engineering. The initial safe path is a user-controlled handoff: Ve resolves and displays the exact file/contact, opens the official chat, and the user attaches/reviews/sends. Automatic sending remains blocked unless an officially supported, terms-compliant personal-account interface is verified.

### FR-7: Learn locally (later phase)

- Make learning and event retention opt-in, visible, pausable, exportable, and erasable.
- Separate explicit memories/contacts from behavior history and derived model state.
- Learn only from data needed for a defined local feature; do not silently fine-tune on every interaction.
- Suggestions must be dismissible, never execute automatically, and remain off until evaluation demonstrates acceptable usefulness and false-positive rates.

### FR-8: Federated learning (research phase only)

- Do not connect a coordinator or transmit model updates in the initial product phases.
- Require measurable utility over local-only learning plus threat model, secure aggregation, privacy accountant/budget, cohort handling, poisoning defenses, signed artifacts, opt-out/deletion, and independent review before real-user trials.
- Do not describe clipping, encryption, or FedAvg alone as differential privacy or secure aggregation.

## 5. Security and privacy requirements

Ve cannot guarantee safety on a compromised host. It must limit the additional authority and blast radius Ve itself introduces.

- Keep Electron renderer sandboxed with context isolation, no Node integration, restrictive CSP, limited navigation, and validated IPC sender/origin. Expose one narrow bridge method per operation, not generic IPC.
- Treat user text, model output, retrieved web pages, documents, app metadata, and connector responses as untrusted. Retrieved content can inform a plan but cannot grant permissions or rewrite policy.
- Keep authorization in deterministic main-process policy. Validate actor, capability, parameter schema, resource scope, state, and confirmation at execution time.
- Do not provide arbitrary shell/PowerShell, unrestricted filesystem access, blanket browser control, credential-store access, admin elevation, or silent data egress to the planner.
- Use least-privilege connectors and short-lived scoped credentials where APIs require them; keep secrets in OS credential storage, never prompts/logs.
- Apply explicit per-capability risk classes: read/open, local reversible action, external communication/data transfer, and destructive/system-level change.
- Make confirmation specific to the exact side effect and expire it after use/change/timeout. The confirmation UI itself must not be spoofable by a web page or model output.
- Include prompt-injection, malicious shortcut/app catalog, path traversal, symlink, IPC forgery, replayed confirmation, connector compromise, and data-exfiltration cases in the threat model.
- Keep security controls independent of model choice: replacing a model must not expand its permissions.

## 6. Non-functional requirements and measures

Set thresholds after choosing target OS and representative low-spec hardware; do not promise sub-100ms for networked discovery or multi-step work.

- **Resource use:** measure idle/peak RAM, CPU, model load time, battery impact, and disk size on the declared minimum machine.
- **Latency:** report separate timings for local parse, resource lookup, integration action, and end-to-end task. Common local actions should feel immediate; network latency is reported honestly.
- **Offline:** app discovery, local file opening, and deterministic known commands should remain useful offline. Online lookup and remote service actions must fail gracefully.
- **Reliability:** measure end-to-end task success, correct-target rate, false action rate, clarification rate, partial completion, recovery, and cancellation—not only intent accuracy.
- **Security:** test that untrusted input cannot escape schemas or scopes, and that unauthorized side effects fail closed.
- **Compatibility:** publish an OS/app integration support matrix and test updates where OS/app changes could break an adapter.
- **Accessibility:** keyboard navigation, visible progress, screen-reader labels, and simple approve/reject/cancel flows.
- **Maintainability:** version contracts and connectors; isolate OS and app-specific code; document adapter ownership, failure handling, and support status.

## 7. MVP acceptance workflows

The first release target should prove these vertical slices on one declared OS, then expand:

1. Launch an installed app that was not named in Ve's source code.
2. Open a URL or a user-selected PDF/image with the OS-associated app.
3. Find a named PDF/image in one approved folder; ask the user to choose among ambiguous matches.
4. Look up a media title online, show source/availability and destination, then open the chosen service.
5. Search/play a Spotify item only after connector feasibility, account authorization, and policy review are complete.
6. Prepare a WhatsApp file share and require confirmation bound to exact file and contact; only ship sending if a supported/terms-compliant integration is available. Otherwise clearly report the limitation and provide a safe manual handoff.

For every workflow, test success, no match, ambiguous match, offline/unavailable service, malformed input, permission denial, cancellation, and malicious/prompt-injection content. Use synthetic test files/accounts and do not send real messages during automated acceptance.

## 8. Research basis and constraints

These sources support requirements and design constraints; they do not guarantee a particular architecture will work without project-specific evaluation.

- Electron recommends sandboxing renderers, context isolation, restrictive navigation, and validating IPC senders: [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security), [context isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation), [IPC](https://www.electronjs.org/docs/latest/tutorial/ipc).
- OWASP identifies excessive agent agency and prompt injection as risks, recommending least privilege, strict tool-boundary checks, and treating retrieved content as untrusted: [Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/), [Prompt Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html), [AI Agent Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html).
- Google's FunctionGemma is a specialized 270M function-calling model and its docs describe a compound approach where a lightweight edge model handles common local actions while larger models are reserved for harder cases. This supports evaluating a hybrid design; it does not prove that a 10–20M model is sufficient for Ve: [FunctionGemma overview](https://ai.google.dev/gemma/docs/functiongemma).
- sherpa-onnx documents local offline ASR, Node.js bindings, optional `node-cpal` microphone capture, and a streaming English Zipformer 20M model with roughly 43.6 MB of int8 model files. Its docs caution that the small model may have lower accuracy: [sherpa-onnx JavaScript API and microphone dependency](https://k2-fsa.github.io/sherpa/onnx/javascript-api/install.html), [streaming Zipformer 20M model](https://github.com/k2-fsa/sherpa/blob/master/docs/source/onnx/pretrained_models/online-transducer/zipformer-transducer-models.rst).
- Whisper.cpp lists a 75 MiB tiny/tiny.en model: [model sizes](https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md). Vosk documents small models around 50 MB and about 300 MB runtime memory, with language-specific accuracy differences: [model catalog and resource notes](https://alphacephei.com/vosk/models).
- Microsoft documents OS-managed Windows app identities and file pickers, supporting dynamic app discovery and user-selected file access rather than model-chosen paths: [AUMID discovery](https://learn.microsoft.com/en-us/windows/configuration/store/find-aumid), [Windows file pickers](https://learn.microsoft.com/en-us/windows/apps/develop/files/using-file-folder-pickers).
- OSWorld evaluates computer-use agents on real desktop/web tasks, including cross-app workflows. Its benchmark and later long-horizon follow-up illustrate why Ve needs end-to-end task evaluation and scoped targets rather than assuming generic UI automation is solved: [OSWorld paper](https://arxiv.org/abs/2404.07972), [OSWorld 2.0 paper](https://arxiv.org/abs/2606.29537).
- Spotify's official docs expose catalog search and playback APIs but note OAuth scopes, Premium requirements, current development-mode restrictions, and prohibitions on AI training with Spotify content / commercial streaming integrations. Recheck before implementation: [Spotify Web API](https://developer.spotify.com/documentation/web-api), [Search reference](https://developer.spotify.com/documentation/web-api/reference/search), [Start playback](https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback), [Authorization and PKCE](https://developer.spotify.com/documentation/web-api/concepts/authorization), [Quota modes](https://developer.spotify.com/documentation/web-api/concepts/quota-modes), [February developer-mode changes](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide), [July 2026 quota update](https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates).
- TMDB's provider data is backed by JustWatch, lacks direct provider deep links, requires JustWatch attribution, and requires a commercial license for commercial projects: [TV watch-provider endpoint](https://developer.themoviedb.org/reference/tv-series-watch-providers), [TMDB API FAQ and license guidance](https://developer.themoviedb.org/docs/faq).
- WhatsApp click-to-chat opens a chat and can prefill text; its desktop client supports manual file attachments. The Cloud API and Business Platform support business-to-customer messages, templates, and paid messaging, but are not a general personal-account automation API. Avoid unsupported personal-account automation: [Click to chat](https://faq.whatsapp.com/5913398998672934), [Send media manually](https://faq.whatsapp.com/453914586839706/), [WhatsApp for Desktop](https://faq.whatsapp.com/451924530376167/), [Business Platform features](https://whatsappbusiness.com/products/business-platform-features/), [Business policy](https://whatsappbusiness.com/policy/), [WhatsApp Terms](https://www.whatsapp.com/legal/terms-of-service).
- NIST's GenAI profile recommends lifecycle risk management and ongoing measurement of trustworthy AI properties: [NIST AI 600-1](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence).

**Research checked:** 2026-10-24. Recheck service policies, API availability, and pricing during connector implementation because they can change.
