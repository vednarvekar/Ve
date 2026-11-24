# Legal and Platform Checks

**This is research, not legal advice.** It is a snapshot of publicly available terms and docs, read and summarized by a non-lawyer, to help a solo founder make informed decisions. Before commercial launch (and especially before charging money or adding EU users), get a real lawyer to review the privacy policy, the WhatsApp/Spotify automation design, and the API integrations.

All pages were accessed **November 6, 2026**. Terms change — re-check before shipping a feature that depends on them.

## 5-line summary

Driving WhatsApp Desktop with UI automation is **Risky**: the Terms ban "automated means" broadly, with no exception for your own account or accessibility-style tools, even though real-world enforcement has so far targeted modified apps, not screen-reader-style automation — a human-presses-Send fallback lowers detection risk but doesn't fix the wording. Playing a song via the `spotify:track:...` link is **Likely OK** and doesn't need Premium or a developer account; the official Web API play-endpoint is **Likely OK but Premium-only**, and voice-controlled Spotify features are banned outright. Opening a YouTube search page is **Likely OK** (just a web link); pulling a creator's latest video via the official Data API with an API key is also **Likely OK** and needs no Google review. Gmail/Calendar/Drive need Google's OAuth checks, but a local-only app can likely skip the expensive security audit (CASA) if it only asks for lighter scopes; Outlook/Teams via Microsoft Graph is **Likely OK** technically, but some company IT departments will block it until an admin approves it. Keeping logs on-device only is **Likely OK** under GDPR and India's DPDP Act since the developer never touches that data; your own update/crash/license servers do need a basic privacy policy and data hygiene.

## Jargon, in one line each

- **ToS** = Terms of Service, the rulebook you agree to by using a product.
- **API** = a way for software to talk to another company's service directly (not through a screen).
- **OAuth** = the "Sign in with Google/Microsoft" pop-up that lets an app act on your behalf without seeing your password.
- **Scope** = a specific permission an app asks for (e.g., "read your email").
- **CASA** = Cloud Application Security Assessment — a paid security audit some Google scopes require.
- **Delegated permission** = the app acts as the signed-in user, not as itself.
- **Admin consent** = a company's IT administrator must approve the app before employees can use it.
- **Data Fiduciary / Controller** = the legal term for whoever decides why and how personal data is used.
- **GDPR** = the EU's privacy law. **DPDP Act** = India's privacy law (2023, still being phased in).

## Summary table

| Item | Verdict | Why | Safer fallback | Source |
|---|---|---|---|---|
| 1. WhatsApp UI automation | **Risky** | ToS bans "automated means" of using the service broadly; no exception for your own account or accessibility-style tools | Human must personally review and press Send/Enter for every message; treat as reducing detection risk, not a legal green light | whatsapp.com/legal/terms-of-service |
| 2. Spotify: `spotify:track:...` link | **Likely OK** | Not part of the "Spotify Platform" (APIs/SDKs) the Developer Terms govern; no Premium requirement documented | Use the URI scheme, not the Web API, for simple play-this-song requests | developer.spotify.com/documentation/web-api/concepts/spotify-uris-ids |
| 2b. Spotify Web API playback | **Likely OK, Premium-only** | Endpoint explicitly requires Premium; voice-control features are banned by policy | Fall back to the URI-scheme approach for Free users | developer.spotify.com/documentation/web-api/reference/start-a-users-playback |
| 3. YouTube search URL in browser | **Likely OK** | Just a normal web link; not "use of the API" at all | — | youtube.com/t/terms |
| 3b. YouTube Data API "latest video" | **Likely OK** | Standard, documented pattern; no OAuth/user data involved for public metadata | Use `channels.list` + `playlistItems.list`, not `search.list` (cheaper quota) | developers.google.com/youtube/terms/developer-policies |
| 4. Gmail/Calendar/Drive via Google OAuth | **Unclear→Likely OK with care** | Calendar and `drive.file` are "sensitive" (free, ~10 days review); full Gmail read/modify scopes are "restricted" and may trigger a paid security audit unless you declare a local-only architecture | Request `gmail.send` + `drive.file` + Calendar only; avoid `gmail.readonly`/`modify` if possible | support.google.com/cloud/answer/13463073 |
| 5. Microsoft Graph (Outlook/OneDrive/Teams) | **Likely OK, with a caveat** | None of the needed delegated permissions require admin consent by default, but company IT policies can still block consent tenant-wide until an admin approves | Design for a graceful "ask your IT admin" message when consent is blocked | learn.microsoft.com/en-us/graph/permissions-reference |
| 6. GDPR / India DPDP Act | **Likely OK for on-device data; real but small duties for your own servers** | Developer never touches on-device data, so has no practical controller/fiduciary role for it; developer's update/crash/license servers do process personal data and need basic hygiene | Keep architecture local-first; write a short privacy policy for the 3 small servers; scrub PII from crash reports | gdpr-info.eu/art-4-gdpr; meity.gov.in DPDP Act 2023 PDF |

---

## 1. WhatsApp: driving WhatsApp Desktop with UI automation

**Verdict: Risky.**

WhatsApp's Terms of Service (`https://www.whatsapp.com/legal/terms-of-service`, effective date shown as January 4, 2021, still the live version) bans, under "Acceptable Use Of Our Services":

> "You will not use (or assist others in using) our Services in ways that: ... (e) involve sending illegal or impermissible communications such as bulk messaging, auto-messaging, auto-dialing, and the like; or (f) involve any non-personal use of our Services unless otherwise authorized by us."

And, more importantly for this feature, under "Harm To WhatsApp Or Our Users":

> "You must not (or assist others to) directly, indirectly, **through automated or other means**, access, use, copy, adapt, modify... our Services in impermissible or unauthorized manners... you must not directly or through automated means: ... (e) create accounts for our Services through unauthorized or automated means..."

There is **no exception anywhere** in the Terms for accessibility tools, screen readers, macro tools, or automating your own account. The wording — "through automated or other means" — covers *any* programmatic interaction with the official app, not just bulk sending by a third party.

**Is there a real difference between server-side bulk messaging and one-message, user-requested local automation?** Not in the text. In practice, WhatsApp's documented bans (WhatsApp Plus, GBWhatsApp, OGWhatsApp) all involved **modified app binaries**, not official, unmodified apps being driven by OS accessibility features — WhatsApp help-center text from that era said:

> "WhatsApp Plus is an application that was not developed by WhatsApp, nor is it authorized by WhatsApp... Please uninstall your application and install an authorized version of WhatsApp." (quoted via Android Authority, 2015, reporting WhatsApp's own FAQ text)

Driving the real, signed, official desktop app via Windows UI Automation (the same mechanism screen readers use) is a different *kind* of thing than installing a modified client — but it still falls inside the literal "automated means" language.

**Does "user presses Send" fix it?** Partially, in practice, not in the text. A design where the assistant fills in the WhatsApp message box but a human must personally click Send (or press Enter) for every message:
- Looks, behaviorally, much more like normal human typing (same timing patterns, no bulk velocity) — which matters because WhatsApp's abuse detection is pattern-based, not a human reading your code.
- Does **not** resolve the clause's language, because the clause is written around "use... through automated means" broadly, not just around who presses the final button. Filling a text box with automation is itself "use through automated means" under a literal reading.

**Recommendation:** Treat this as account risk the **user** takes on, disclose it clearly in-app ("this may violate WhatsApp's terms for your account — proceed at your own risk"), keep volume low and always-human-confirmed, and don't market it as a way around WhatsApp's automation rules. If the feature needs to scale, the properly sanctioned path is the separate WhatsApp Business Platform API (`whatsapp.com/legal/business-terms`), which is a different product with its own terms built for exactly this kind of sending.

---

## 2. Spotify: playing a specific song

**Verdict: Likely OK (URI scheme) / Likely OK but Premium-only (Web API).**

Spotify's Developer Terms (v10, effective May 15, 2025, at `developer.spotify.com/terms`) define the "Spotify Platform" narrowly as "our developer tools accessible (e.g. APIs, SDKs, Widgets)." The official Web API playback endpoint says plainly:

> "Start a new context or resume current playback on the user's active device. **This API only works for users who have Spotify Premium.**" (`developer.spotify.com/documentation/web-api/reference/start-a-users-playback`)

So if the assistant uses the Web API (OAuth + credentials) to start playback, it needs Premium and needs to accept Spotify's Developer Agreement — which also bans a specific thing worth flagging:

> "Do not create a voice-enabled SDA that enables a user to control Spotify with their voice, or any kind of voice assistant that provides voice-control functionality." (Developer Policy, Section III.3, `developer.spotify.com/policy`)

Since this assistant is voice/text-command-driven, **using the official Web API to control Spotify would likely be "Likely not allowed"** under this clause if framed as voice control, regardless of Premium status.

The simpler, lower-risk path is launching the `spotify:track:ID` URI (e.g., via Windows' `ShellExecute`), which opens the installed Spotify Desktop app and plays that track:

> "Spotify URI: The resource identifier of, for example, an artist, album or track. This can be entered in the search box in a Spotify Desktop Client, to navigate to that resource." (`developer.spotify.com/documentation/web-api/concepts/spotify-uris-ids`)

This isn't part of the defined "Spotify Platform" (no API/SDK/credentials involved) — it's a Windows-registered link handler, the same mechanism as clicking a link in a browser. No Premium requirement is documented for it, and Spotify's own design guidance actively **encourages** linking out to the app rather than building in-app streaming:

> "always link to the Spotify app... The Spotify app is the default playback mechanism." (`developer.spotify.com/documentation/design`)

**Caveat:** I could not find a live, current Spotify support page confirming today's exact Free-tier Desktop playback behavior (shuffle-only restrictions historically applied to the Free **mobile** app, not Desktop) — treat this detail as reasonably likely but not freshly confirmed.

**Recommendation:** Use the `spotify:track:...` URI for "play this song" requests. Avoid the Web API entirely unless you need to read playback state for Premium users and are careful never to frame it as voice control of Spotify.

---

## 3. YouTube: search and "latest video of a creator"

**Verdict: Likely OK for both.**

YouTube's Terms of Service (`youtube.com/t/terms`, dated January 5, 2022, still current) bans:

> "access the Service using any automated means (such as robots, botnets or scrapers) except (a) in the case of public search engines, in accordance with YouTube's robots.txt file; or (b) with YouTube's prior written permission"

but explicitly allows normal browsing:

> "You can use parts of the Service, such as browsing and searching for Content, without having a Google account."

**Opening a search URL** (e.g., `youtube.com/results?search_query=...`) in the user's browser involves no credentials, no API, and no data extraction by your app — it's a normal hyperlink, identical to clicking a link in an email. This is **not** "use of the API" at all and isn't covered by the separate API Services Terms.

**Fetching a creator's latest video via the YouTube Data API v3** with a developer API key (not OAuth) is a standard, sanctioned pattern. The Developer Policies confirm public data needs no user authorization:

> "The YouTube Data API service requires authorization for some actions. For example, an API Client can search for public videos but does not need user authorization to do so." (`developers.google.com/youtube/terms/developer-policies`, III.D.2)

This means **no Google OAuth verification process applies** — that process is only for apps requesting user-consent scopes. A plain API key for public metadata is exempt.

**Design tip:** use `channels.list` (get the channel's "uploads" playlist ID) + `playlistItems.list` to find the latest video, **not** `search.list` — the quota docs show `search.list` is separately capped at only 100 calls/day, while `channels.list`/`playlistItems.list` draw from the much larger shared 10,000-units/day pool at 1 unit each (`developers.google.com/youtube/v3/determine_quota_cost`).

Other requirements if you display YouTube data in your UI: keep cached metadata fresh (refresh or delete after 30 days per Developer Policies III.E.4.d), show titles/thumbnails unmodified, and add a small clickable YouTube logo/attribution per the branding guidelines (`developers.google.com/youtube/terms/branding-guidelines`) — none of these block the feature, they're just housekeeping.

---

## 4. Google API verification for Gmail/Drive/Calendar

**Verdict: Unclear-but-manageable** — depends heavily on which exact scopes you request.

Google classifies OAuth scopes into three tiers (`developers.google.com/workspace/guides/configure-oauth-consent`):

> "Non-sensitive... Sensitive: Grant access to personal user data, resources, or actions... Restricted: Grant access to highly-sensitive or extensive user data or actions."

### Scope classification for this app

| Scope | Tier | Verification needed |
|---|---|---|
| `gmail.send` | Sensitive | Free, ~10 business days |
| `gmail.readonly` / `gmail.modify` / `gmail.compose` | **Restricted** | Free review, but may also require a paid security audit (see below) |
| `calendar` / `calendar.events` | Sensitive | Free, ~10 business days |
| `drive.file` (per-file access) | **Non-sensitive** | None required for functionality; only for showing your app name/logo |
| `drive` (full access) | **Restricted** | Free review + possible paid audit |

Google's Gmail scope docs list the exact wording:

> "`gmail.readonly` — View your email messages and settings." (Restricted) ... "`gmail.send` — Send email on your behalf." (Sensitive) (`developers.google.com/workspace/gmail/api/auth/scopes`)

Drive's docs confirm `drive.file` is the lighter-weight option:

> "`drive.file` — Create new Drive files, or modify existing files, that you open with an app..." listed under Non-sensitive scopes. "Since `drive.file` is non-sensitive, it allows for a more streamlined verification process." (`developers.google.com/workspace/drive/api/guides/api-specific-auth`)

### The CASA security audit (expensive part) — only for restricted scopes + a server

> "Every app that requests access to Google users' restricted data and has the ability to access data **from or through a third-party server** must go through a security assessment." (`developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification`)

This is the key sentence for a local-only app: the costly CASA audit is conditioned on data passing through **your server**. A purely local Rust/Tauri app with no backend should be able to declare this during verification and potentially skip the paid audit — though Google's current pages don't spell out a formal "local client exemption" as explicitly as an older (2019) archived version did, so this should be confirmed directly with Google when you submit.

**Cost/timeline, if CASA is needed anyway:** Google doesn't charge for verification itself, but independent CASA assessors do — current published vendor pricing runs roughly **$675–$5,400** depending on tier, with a **1–4 week** assessor timeline on top of Google's own **~6-week** overall restricted-scope review estimate (`support.google.com/cloud/answer/13463817`). Avoiding restricted scopes (`gmail.readonly`/`modify`/`compose`, full `drive`) sidesteps this entirely.

### The 100-user testing cap

> "Projects configured with a publishing status of Testing are limited to up to 100 test users listed in the OAuth consent screen... Authorizations by a test user will expire seven days from the time of consent." (`support.google.com/cloud/answer/15549945`)

For personal/small-scale use, Google also notes:

> "If the app is for your personal use (fewer than 100 users), you and your limited number of users can continue using the app without going through verification (users will be allowed to click through 'unverified app' warning screens during sign-in)." (`support.google.com/cloud/answer/13464323`)

**Recommendation:** Start with `gmail.send` + `drive.file` + Calendar scopes only (all sensitive/non-sensitive, free, ~10 days). Only add `gmail.readonly`/`modify` if truly needed, and declare the local-only architecture explicitly to try to avoid the CASA audit.

---

## 5. Microsoft Graph app registration (Outlook, Calendar, OneDrive, Teams)

**Verdict: Likely OK technically, Risky in some company tenants.**

The official permissions reference (`learn.microsoft.com/en-us/graph/permissions-reference`) shows every delegated permission this app needs is marked **"AdminConsentRequired: No"** for the delegated type:

| Permission | Used for | Admin consent (delegated)? |
|---|---|---|
| `Mail.Read` | Read email | No |
| `Mail.Send` | Send email | No |
| `Calendars.ReadWrite` | Calendar | No |
| `Files.ReadWrite` | Share a file the user owns (least-privileged for `createLink`) | No |
| `Files.ReadWrite.All` | Share files shared *to* the user / SharePoint | No |
| `ChatMessage.Send` | Post to a 1:1/group Teams chat | No |
| `ChannelMessage.Send` | Post to a Teams channel | No |

For OneDrive sharing specifically, the `createLink` API docs confirm the minimal scope:

> "Delegated (work or school account) | Files.ReadWrite | Files.ReadWrite.All, Sites.ReadWrite.All" (`learn.microsoft.com/en-us/graph/api/driveitem-createlink`)

**But** — even though no single permission is individually flagged as needing admin consent, a company's IT admin can still block user consent tenant-wide:

> "Users who aren't an administrator are blocked from granting consent to the application, and they're told to ask their admin for access to the app." (`learn.microsoft.com/en-us/entra/identity-platform/application-consent-experience`)

This is common in regulated or security-conscious companies. Practically: **some office workers will be able to connect Outlook/Teams immediately; others will need their IT admin to approve the app first.** Design the UI to explain this gracefully.

**Publisher verification** (the blue "verified" badge) is free but requires a Microsoft Partner Network account and a verified custom domain — not available to an app registered under a personal Microsoft account:

> "Apps that are registered by using a Microsoft account can't be publisher verified." (`learn.microsoft.com/en-us/entra/identity-platform/publisher-verification-overview`)

Without it, users (especially in tenants with "risk-based step-up consent" enabled) may see an "Unverified" warning or be blocked outright. This doesn't stop the app from working, but it adds friction and a trust warning.

**Teams specifics:** Posting to chats uses `ChatMessage.Send`; posting to channels uses `ChannelMessage.Send` (the combined reference page has a documented copy-paste error listing the wrong permission for chats — the dedicated single-purpose pages are correct). Teams messaging **only works for work/school accounts**, not personal Microsoft accounts:

> "Delegated (personal Microsoft account) | Not supported." (`learn.microsoft.com/en-us/graph/api/chat-post-messages`)

Also worth noting: *"It is a violation of the terms of use to use Microsoft Teams as a log file. Only send messages that people will read."*

**Recommendation:** Register as "Any Entra ID Tenant + Personal Microsoft accounts," use the minimal scopes above, and build a fallback message for users whose company blocks third-party app consent ("ask your IT admin to approve this app").

---

## 6. Privacy law: GDPR and India's DPDP Act 2023

**Verdict: Likely OK for on-device-only data; small, manageable duties for your own servers (update/crash/license).**

### Does GDPR apply at all right now?

GDPR's territorial rule (Article 3(2)) only reaches a company with no EU presence if it targets or monitors EU residents:

> "This Regulation applies to the processing of personal data of data subjects who are in the Union by a controller or processor not established in the Union, where the processing activities are related to: (a) the offering of goods or services... to such data subjects in the Union." (Art. 3(2)(a))

And the interpretive guidance (Recital 23) says simply being downloadable from the EU isn't enough:

> "the mere accessibility of the controller's... website in the Union... is insufficient to ascertain such intention [to target EU users]."

**So:** with no EU marketing/pricing/targeting and an India-first user base, GDPR likely does **not** currently apply — but it would if you later add EU-language localization, EU pricing, or analytics that profile EU users' behavior while they're in the EU.

### Does on-device-only data create any GDPR/DPDP duty for the developer?

Both laws define the regulated party (GDPR "controller," DPDP "Data Fiduciary") as whoever **determines the purposes and means of processing** and actually processes the data:

> "'controller' means the natural or legal person... which... determines the purposes and means of the processing of personal data." (GDPR Art. 4(7))
> "'Data Fiduciary' means any person who alone or in conjunction with other persons determines the purpose and means of processing of personal data." (DPDP Act 2023, Sec. 2(i))

If the developer's servers never receive, see, or touch the on-device logs/habits, the developer has no practical processing relationship to that data — so **essentially no controller/fiduciary obligations attach to the developer for it.** This is a reasonable, widely-held reading, not a court-tested certainty — state it clearly in the privacy policy anyway ("usage logs and learned preferences stay on your device; we never receive or see them").

### What does remain: your own 3 small servers

The developer's update-check, crash-report, and license-activation servers **do** receive personal data (IP addresses, stack traces, email + license key) and the developer **does** decide how that data is used — so ordinary privacy-law hygiene applies regardless of whether GDPR itself is triggered, because India's DPDP Act clearly does apply here (India-first users):

> "Data Fiduciary shall protect personal data in its possession or under its control... by taking reasonable security safeguards to prevent personal data breach." (DPDP Act 2023, Sec. 8(5))
> "adequate, relevant and limited to what is necessary in relation to the purposes for which they are processed ('data minimisation')." (GDPR Art. 5(1)(c), same principle)

**Minimal practical checklist:**
1. Write a short privacy policy describing what the 3 servers collect and why (DPDP Sec. 5 notice; GDPR Art. 13).
2. Minimize data: license server keeps only email + key; update server avoids storing raw IPs long-term; crash reports are scrubbed of usernames/file paths/user content before upload (DPDP Sec. 8; GDPR Art. 5(1)(c)).
3. Basic security (encryption, access control) for the license database (DPDP Sec. 8(5)).
4. A simple way for a user to ask "what do you have on me / delete it" and honor it (GDPR Art. 15/17; DPDP Sec. 11–14).
5. A basic breach-response plan.
6. Don't assume a "startup exemption" — DPDP Sec. 17(3) allows the government to exempt startups, but only via specific notification; none applies automatically.

### Current status of India's DPDP Act (important — changes soon)

The Act (No. 22 of 2023) is law, but most of it is switched on in stages. As of today:

> The Digital Personal Data Protection **Rules, 2025** were notified 13–14 November 2025 and "introduce an eighteen-month period for phased compliance." (PIB press release, Release ID 2190655)

Per the Gazette commencement schedule: foundational sections and the Data Protection Board are already in force; the Consent Manager framework activates **13 November 2026** (about a week from today); and most of the detailed day-to-day compliance machinery (notice content, security-safeguard specifics, breach timelines, the 90-day rights-request process) doesn't become legally binding until **13 May 2027**. You're not yet under a hard deadline for the detailed rules, but building toward them now avoids a scramble later.

---

## Open questions for a lawyer

1. Does the WhatsApp UI-automation feature create meaningful legal exposure for **the company** (not just ToS/account risk for the user), e.g., under India's IT Act or similar, given it automates interaction with a third-party service without that service's authorization?
2. Should the app's Terms of Service/EULA include an explicit disclaimer shifting WhatsApp/Spotify/YouTube ToS risk to the end user, and is such a disclaimer enforceable in India?
3. Is the "local-only, no controller/fiduciary role for on-device data" position solid enough to rely on without a specific regulatory opinion, or should it be hedged further in the privacy policy?
4. When should the business register for GDPR compliance preemptively (before vs. after any EU users appear organically)?
5. Does accepting payments (license server) trigger any additional Indian data-localization or payment-data rules (e.g., RBI rules on card data) beyond DPDP?
6. Is a Partner Network / publisher verification worth pursuing early for Microsoft Graph, given the "Unverified" warning and admin-consent friction in company tenants?
7. Should the Gmail integration be designed from day one to avoid restricted scopes entirely (e.g., `gmail.send`-only, no reading inbox), to sidestep CASA risk permanently rather than relying on a "declare local-only" argument during verification?
