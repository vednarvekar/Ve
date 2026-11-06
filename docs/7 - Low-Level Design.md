# Local Assistant Engine --- 07 Low-Level Design

**6 Nov 2026** · **@Ved Narvekar**

## Summary

This doc details how each part in 06 High-Level Design works inside:
formats, interfaces, rules and tables. Engineers build from it directly.
Like the HLD, it is a draft until the spikes in 05 confirm the model
choices and numbers.

## Processes

Three processes keep crashes and memory spikes contained.

  -----------------------------------------------------------------------
  Process           Runs              Talks to          Starts
  ----------------- ----------------- ----------------- -----------------
  UI                Command bar,      Core, over local  At login, hidden
                    confirms,         IPC               until the hotkey
                    settings (Tauri)                    

  Core              Router flow,      UI and Model      At login, as a
                    skills, policy,   worker            background
                    connectors, store                   service
                    (Rust)                              

  Model worker      Tier 0 encoder    Core only         With Core;
                    and Tier 1 base                     restarted by Core
                    model (ONNX                         if it crashes
                    Runtime,                            
                    llama.cpp)                          
  -----------------------------------------------------------------------

IPC uses named pipes on Windows with small JSON messages. Only Core can
reach apps or the network. The Model worker has no network access.

## Skill file format

Each V1 task is one YAML skill file. Skills are data, not code, so new
tasks don't need an engine rebuild. Here is task M2, sending a file on
WhatsApp.

``` yaml
id: whatsapp.send_file          # task M2
version: 1
risk: sends_or_shares            # safe | read_only | changes_data | sends_or_shares
examples:                        # used to train the router
  - "send this file to ved on whatsapp"
  - "whatsapp the pdf to Ved"
slots:
  file:
    type: file_ref
    required: true
    resolve: [selected_file, named_file, recent_download]
  contact:
    type: contact
    required: true
    resolve: [named_contact, usual_contact]
  app: whatsapp
confirm:
  text: "Send {file.name} to {contact.name} on WhatsApp?"
steps:
  - connector: whatsapp_desktop
    action: open_chat
    args: { contact: "{contact}" }
  - connector: whatsapp_desktop
    action: attach_and_send
    args: { file: "{file.path}" }
check:                            # verifier rule
  connector: whatsapp_desktop
  action: last_message_is_file
  args: { contact: "{contact}", file_name: "{file.name}" }
undo: none                        # sent messages can't be unsent in v1
fallback: open_chat_and_wait      # SP5 fallback: user presses Send
```

Rules: every slot lists its resolve order. Every skill has a check. A
skill with risk `sends_or_shares` must have a confirm.

## Router and extractor

Both run on the shared Tier 0 encoder in one pass. Input is the request
text plus a short context note (open app, selected item).

``` json
{
  "tasks": [
    { "id": "whatsapp.send_file", "score": 0.94 },
    { "id": "email.send", "score": 0.03 }
  ],
  "out_of_scope": 0.01,
  "chained": false,
  "spans": [
    { "text": "this file", "type": "file_ref" },
    { "text": "ved", "type": "contact" },
    { "text": "whatsapp", "type": "app" }
  ]
}
```

### Confidence rules (tuned in SP1)

  -----------------------------------------------------------------------
  Condition                           Action
  ----------------------------------- -----------------------------------
  Top task 0.85 or higher, not        Use that skill directly
  chained                             

  Top task 0.50--0.85, or chained     Send to the planner with the top 5
                                      skills

  Out of scope 0.60 or higher         Decline and explain

  Everything below 0.50               Ask one short question with the top
                                      2--3 tasks as choices
  -----------------------------------------------------------------------

## Resolver

The resolver fills each slot by trying sources in the order the skill
lists, and stops at the first exact match.

  -----------------------------------------------------------------------
  Source                  Example                 Used for
  ----------------------- ----------------------- -----------------------
  Selected item           File highlighted in     "this", "this file"
                          File Explorer           

  Named item              "report.pdf", "Ved"     Explicit names

  Recent item             Newest download, last   "the pdf I just
                          opened deck             downloaded"

  Usual choice            The Ved this user       Learned defaults
                          always messages         

  Fuzzy match             "budget thing" matches  Loose descriptions
                          Budget_Q3.xlsx          
  -----------------------------------------------------------------------

### Rules

-   One match: use it.
-   Two or more matches with close scores: ask one question with up to 3
    choices.
-   No match: ask for it, never guess.
-   Contacts for sends: never fuzzy-matched. Only exact names or a
    confirmed choice (SR7).

## Planner

The planner only combines existing skills. It never invents new actions.

**Input:** the request, the context note, and the top 5 skills with
their slot lists.

**Output:** a short plan, at most 5 steps.

``` json
{
  "steps": [
    { "skill": "files.find", "slots": { "query": "budget sheet" } },
    {
      "skill": "whatsapp.send_file",
      "slots": { "file": "$step1.result", "contact": "Rahul" }
    }
  ]
}
```

How it decodes: the model first drafts the plan freely, then a grammar
check shapes it into this format. Drafting first avoids the accuracy
loss small models show under strict formats.

### Plan checks before running

1.  Every skill ID exists.
2.  Every required slot is filled, or linked to an earlier step's
    result.
3.  The plan has 5 steps or fewer.
4.  Any send or share step keeps its confirm.

A plan that fails a check is rejected. The engine says it can't do this
yet, instead of guessing.

## Policy engine

Plain Rust code checks every step before it runs. Rules are checked top
to bottom, and the first match wins.

  ------------------------------------------------------------------------
                         Order If the step...        Then
  ---------------------------- --------------------- ---------------------
                             1 Deletes anything      Block (SR6)
                               permanently           

                             2 Was triggered by text Block and flag (SR5)
                               inside content, not   
                               the user              

                             3 Sends to more than 10 Block in V1
                               recipients            

                             4 Sends or shares       Show confirm with
                                                     recipient and preview
                                                     (SR4)

                             5 Changes data          Run, then show Undo
                                                     for 10 seconds (SR3)

                             6 Is safe or read only  Run right away (SR1,
                                                     SR2)
  ------------------------------------------------------------------------

Every decision is written to the action log, including blocks.

## Connector interface

Every app connector implements the same Rust trait. Skills call
connectors only through it, so adding an app never changes the engine.

``` rust
pub trait Connector {
    /// e.g. "whatsapp_desktop", "gmail", "windows_system"
    fn id(&self) -> &str;
    /// Actions this connector supports, with their argument schemas
    fn actions(&self) -> Vec<ActionSpec>;
    /// Is the app installed, signed in and reachable?
    fn health(&self) -> Health;
    /// Run one action. Must not retry on its own.
    fn execute(&self, action: &str, args: Args) -> Result<Output, ConnError>;
    /// Check that an action really happened (used by the verifier)
    fn check(&self, action: &str, args: Args) -> Result<bool, ConnError>;
    /// Reverse an action if possible. None = cannot be undone.
    fn undo(&self, action: &str, output: &Output) -> Option<Result<(), ConnError>>;
}
```

**V1 connectors:** `gmail`, `google_calendar`, `google_drive`,
`outlook`, `outlook_calendar`, `onedrive`, `teams`, `whatsapp_desktop`,
`spotify`, `browser`, `files`, `windows_system`, `web_lookup`,
`local_calc`, `reminders`.

## Model scheduler

The big model loads only when a request needs it. Tier 1 base model
states. The Tier 0 encoder stays loaded the whole time.

``` text
[Unloaded: no memory used] --planner needed--> [Loading from disk] --loaded--> [Ready: in memory, idle]
[Ready] --request--> [Busy: planning] --done--> [Ready]
[Ready] --idle timeout, or memory needed elsewhere--> [Unloaded]
```

The scheduler keeps total model memory under 2GB. Model files are
memory-mapped, so a reload is fast. When the router flags a likely
planner request, loading starts early, while the extractor is still
running.

## Database tables

One encrypted SQLite file (SQLCipher). The key lives in Windows
Credential Manager.

``` sql
-- Learned defaults, e.g. usual contact for "Ved" on WhatsApp
CREATE TABLE defaults (
    id INTEGER PRIMARY KEY,
    slot_type TEXT NOT NULL,       -- contact | file_folder | app | playlist
    phrase TEXT NOT NULL,          -- what the user typed, e.g. "ved"
    context TEXT,                  -- e.g. "whatsapp"
    value TEXT NOT NULL,           -- resolved item ID
    uses INTEGER DEFAULT 1,
    last_used TEXT NOT NULL
);

-- Every request and decision, viewable by the user
CREATE TABLE action_log (
    id INTEGER PRIMARY KEY,
    at TEXT NOT NULL,
    request TEXT NOT NULL,
    skill_id TEXT,
    decision TEXT NOT NULL,        -- ran | confirmed | cancelled | blocked | failed
    result TEXT,
    undo_token TEXT                -- set while Undo is possible
);

CREATE TABLE reminders (
    id INTEGER PRIMARY KEY,
    due_at TEXT NOT NULL,
    text TEXT NOT NULL,
    repeat TEXT,                   -- null | daily | weekly
    done INTEGER DEFAULT 0
);

CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

## Error handling

Every failure ends with a clear one-line message. The engine never fails
silently.

  -----------------------------------------------------------------------
  Failure                 What the engine does    Message example
  ----------------------- ----------------------- -----------------------
  App not installed       Stops before running    "Spotify isn't
                                                  installed."

  Not signed in, or       Offers to sign in again "Please sign in to
  sign-in expired                                 Gmail again."

  No internet             Runs offline tasks;     "Weather needs an
                          explains for online     internet connection."
                          ones                    

  App UI changed          Uses the skill's        "I opened Ved's chat.
  (accessibility path     fallback, like opening  Press Send to finish."
  broken)                 the chat for the user   

  Check failed after an   Retries once, then      "The file may not have
  action                  reports                 sent. Please check
                                                  WhatsApp."

  Model worker crashed    Core restarts it and    "Something went wrong.
                          retries the request     Trying again."
                          once                    

  Not enough memory for   Unloads other models;   "I can't plan that
  Tier 1                  if still short,         right now. Try a
                          declines                simpler request."

  Step fails in a chain   Stops the chain; keeps  "Found the file, but
                          earlier results         sending failed."
  -----------------------------------------------------------------------

## Open decisions

The screenshot shows the **Open decisions** heading and the beginning of
a checklist. The visible first item appears to begin: "Confirm the
confidence thresholds with SP1 results." The remaining text is cut off
in the supplied images.
