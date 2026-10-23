# LLD: Intent Parser & Command Schema Specification

## 1. Overview

The Intent Parser acts as the contract bridge between human linguistic variance and deterministic machine execution. Every parsed utterance is normalized into an intermediate Abstract Syntax Tree (Command AST).

---

## 2. Command AST Definition

```typescript
export interface CommandAST {
  version: 1;
  id: string;
  sourceText: string;
  intent: IntentType;
  confidence: number;            // Normalized 0.0 - 1.0
  slots: Record<string, SlotValue>;
  fallbackApplied: boolean;
}

export type IntentType =
  | "app.launch"
  | "app.close"
  | "web.search"
  | "web.navigate"
  | "system.volume"
  | "system.brightness"
  | "system.media"
  | "comm.message"
  | "notes.create"
  | "assistant.clarify"
  | "assistant.unknown";

export interface SlotValue {
  rawValue: string;
  normalizedValue: string | number | boolean;
  confidence: number;
}
```

---

## 3. Core Intent Schemas

Each intent defines a strict JSON schema for parameter validation using standard TypeScript types or Zod schemas:

### A. `app.launch`
```typescript
export interface AppLaunchParams {
  appIdentifier: string;         // Canonical app key e.g., "chrome", "vscode", "terminal"
  displayName?: string;          // User-facing name e.g., "Visual Studio Code"
  arguments?: string[];          // Safe command-line arguments (if authorized)
}
```

### B. `web.navigate`
```typescript
export interface WebNavigateParams {
  url: string;                   // Must be validated HTTP or HTTPS URI
  targetBrowser?: "default" | "chrome" | "firefox" | "edge";
  newTab?: boolean;
}
```

### C. `web.search`
```typescript
export interface WebSearchParams {
  query: string;                 // URL-safe sanitized search string
  engine?: "google" | "duckduckgo" | "bing" | "youtube";
}
```

### D. `comm.message`
```typescript
export interface CommMessageParams {
  platform: "whatsapp";
  recipient: {
    contactId?: string;
    name?: string;
    phoneE164: string;           // E.164 formatted telephone number
  };
  messageBody: string;
}
```

### E. `system.volume`
```typescript
export interface SystemVolumeParams {
  action: "set" | "increase" | "decrease" | "mute" | "unmute";
  deltaPercent?: number;         // e.g. 10 for +10%
  targetPercent?: number;        // e.g. 50 for 50%
}
```

---

## 4. Rule-Based Fallback Engine

Before dispatching to the SLM, the input passes through a high-performance deterministic parser that processes queries in $<1\text{ms}$:

```typescript
export interface DeterministicRule {
  intent: IntentType;
  regexPatterns: RegExp[];
  extractor: (match: RegExpExecArray) => Record<string, SlotValue>;
}

export const DETERMINISTIC_RULES: DeterministicRule[] = [
  {
    intent: "app.launch",
    regexPatterns: [
      /^(?:open|launch|start|run)\s+([a-zA-Z0-9_\-\s]+)$/i,
    ],
    extractor: (m) => ({
      appIdentifier: {
        rawValue: m[1].trim(),
        normalizedValue: resolveAppAlias(m[1].trim()),
        confidence: 1.0,
      },
    }),
  },
  {
    intent: "web.search",
    regexPatterns: [
      /^(?:search|google|find)\s+(?:for\s+)?(.+)$/i,
    ],
    extractor: (m) => ({
      query: {
        rawValue: m[1].trim(),
        normalizedValue: m[1].trim(),
        confidence: 1.0,
      },
    }),
  },
];
```

---

## 5. Ambiguity & Clarification Flow

When confidence falls into the ambiguity window ($0.50 \le \text{confidence} < 0.85$):

```json
{
  "intent": "assistant.clarify",
  "confidence": 0.65,
  "slots": {
    "question": {
      "normalizedValue": "Did you want to search Google for 'vs code' or open the Visual Studio Code application?"
    },
    "candidateIntents": {
      "normalizedValue": ["app.launch:vscode", "web.search:vs code"]
    }
  }
}
```
