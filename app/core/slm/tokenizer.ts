export interface TokenizerOutput {
  inputIds: Int32Array;
  attentionMask: Int32Array;
  tokens: string[];
}

export interface TokenizerOptions {
  maxSeqLen?: number;
  addSpecialTokens?: boolean;
}

export const PAD_TOKEN = "<PAD>";
export const UNK_TOKEN = "<UNK>";
export const BOS_TOKEN = "<BOS>";
export const EOS_TOKEN = "<EOS>";
export const SEP_TOKEN = "<SEP>";
export const MASK_TOKEN = "<MASK>";

export const PAD_ID = 0;
export const UNK_ID = 1;
export const BOS_ID = 2;
export const EOS_ID = 3;
export const SEP_ID = 4;
export const MASK_ID = 5;

/**
 * Built-in Core Domain Vocabulary for Intent Classification and Slot Tagging.
 */
const BASE_VOCABULARY: string[] = [
  PAD_TOKEN,
  UNK_TOKEN,
  BOS_TOKEN,
  EOS_TOKEN,
  SEP_TOKEN,
  MASK_TOKEN,

  // Actions & Verbs
  "open",
  "launch",
  "start",
  "run",
  "close",
  "quit",
  "kill",
  "exit",
  "search",
  "find",
  "look",
  "up",
  "google",
  "browse",
  "visit",
  "go",
  "to",
  "send",
  "message",
  "text",
  "whatsapp",
  "chat",
  "saying",
  "that",
  "tell",
  "write",
  "play",
  "show",
  "list",
  "make",
  "create",
  "set",
  "increase",
  "decrease",
  "mute",
  "unmute",

  // Target Applications
  "chrome",
  "google-chrome",
  "firefox",
  "visual",
  "studio",
  "code",
  "vscode",
  "terminal",
  "notepad",
  "calculator",
  "explorer",
  "files",
  "slack",
  "spotify",
  "discord",
  "telegram",
  "settings",
  "browser",
  "app",
  "application",

  // Search Providers & Web Targets
  "youtube",
  "netflix",
  "github",
  "reddit",
  "bing",
  "duckduckgo",
  "wikipedia",
  "twitter",
  "x",

  // Common Query & Domain Terms
  "weather",
  "tomorrow",
  "today",
  "lofi",
  "beats",
  "music",
  "video",
  "songs",
  "news",
  "movie",
  "movies",
  "series",
  "shows",
  "comedy",
  "action",
  "documentation",
  "docs",
  "tutorial",
  "stock",
  "price",

  // Slot Markers & Prepositions
  "on",
  "in",
  "at",
  "for",
  "with",
  "from",
  "my",
  "the",
  "a",
  "an",
  "please",
  "hey",
  "hello",
  "hi",
  "say",

  // Common Names & Entities
  "alex",
  "ved",
  "mom",
  "dad",
  "john",
  "sarah",
  "friend",
  "boss",
  "team",

  // Web Protocols & Extensions
  "http",
  "https",
  "com",
  "org",
  "net",
  "io",
  "www",
  ".",
  ":",
  "/",
  "?",
  "=",
  "&",
  "-",
  "_",
];

export class FastTokenizer {
  private vocabToId = new Map<string, number>();
  private idToVocab = new Map<number, string>();
  private nextId = 0;

  constructor() {
    this.buildVocabulary();
  }

  private buildVocabulary(): void {
    // 1. Register base vocabulary
    for (const token of BASE_VOCABULARY) {
      this.addToken(token);
    }

    // 2. Register single ASCII printable characters (subword fallback)
    for (let code = 32; code <= 126; code++) {
      const char = String.fromCharCode(code);
      if (!this.vocabToId.has(char)) {
        this.addToken(char);
      }
    }
  }

  private addToken(token: string): number {
    const existing = this.vocabToId.get(token);
    if (existing !== undefined) {
      return existing;
    }
    const id = this.nextId++;
    this.vocabToId.set(token, id);
    this.idToVocab.set(id, token);
    return id;
  }

  public get vocabSize(): number {
    return this.nextId;
  }

  public normalize(text: string): string {
    return text
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[\r\n\t]+/g, " ")
      .replace(/[^\x20-\x7E]/g, "") // Keep printable ASCII
      .trim();
  }

  public tokenize(rawText: string): string[] {
    const normalized = this.normalize(rawText);
    if (!normalized) {
      return [];
    }

    // Split text into word tokens and punctuation symbols
    const rawTokens = normalized.match(/[a-zA-Z0-9]+|[^\s\w]/g) ?? [];
    const result: string[] = [];

    for (const rawToken of rawTokens) {
      if (this.vocabToId.has(rawToken)) {
        result.push(rawToken);
        continue;
      }

      // Greedy longest-match subword extraction, falling back to single characters
      let remaining = rawToken;
      while (remaining.length > 0) {
        let matched = false;
        for (let len = remaining.length; len > 0; len--) {
          const sub = remaining.slice(0, len);
          if (this.vocabToId.has(sub)) {
            result.push(sub);
            remaining = remaining.slice(len);
            matched = true;
            break;
          }
        }
        if (!matched) {
          // Fallback to unknown or single char
          const char = remaining[0] ?? "";
          result.push(this.vocabToId.has(char) ? char : UNK_TOKEN);
          remaining = remaining.slice(1);
        }
      }
    }

    return result;
  }

  public encode(text: string, options: TokenizerOptions = {}): TokenizerOutput {
    const maxSeqLen = options.maxSeqLen ?? 32;
    const addSpecialTokens = options.addSpecialTokens ?? true;

    const tokens = this.tokenize(text);
    const finalTokens: string[] = [];

    if (addSpecialTokens) {
      finalTokens.push(BOS_TOKEN);
    }

    for (const token of tokens) {
      if (addSpecialTokens && finalTokens.length >= maxSeqLen - 1) {
        break;
      }
      if (!addSpecialTokens && finalTokens.length >= maxSeqLen) {
        break;
      }
      finalTokens.push(token);
    }

    if (addSpecialTokens && finalTokens.length < maxSeqLen) {
      finalTokens.push(EOS_TOKEN);
    }

    const inputIds = new Int32Array(maxSeqLen);
    const attentionMask = new Int32Array(maxSeqLen);

    for (let i = 0; i < maxSeqLen; i++) {
      if (i < finalTokens.length) {
        const token = finalTokens[i]!;
        const id = this.vocabToId.get(token) ?? UNK_ID;
        inputIds[i] = id;
        attentionMask[i] = 1;
      } else {
        inputIds[i] = PAD_ID;
        attentionMask[i] = 0;
      }
    }

    return {
      inputIds,
      attentionMask,
      tokens: finalTokens,
    };
  }

  public decode(tokenIds: number[] | Int32Array): string {
    const parts: string[] = [];
    for (let i = 0; i < tokenIds.length; i++) {
      const id = tokenIds[i]!;
      if (id === PAD_ID || id === EOS_ID) {
        break;
      }
      if (id === BOS_ID || id === SEP_ID || id === MASK_ID) {
        continue;
      }
      const token = this.idToVocab.get(id) ?? UNK_TOKEN;
      parts.push(token);
    }

    // Join alphanumeric tokens with space, join punctuation cleanly
    let result = "";
    for (const part of parts) {
      if (!result) {
        result = part;
      } else if (/^[^\w\s]$/.test(part)) {
        result += part;
      } else {
        result += " " + part;
      }
    }
    return result;
  }

  public getTokenId(token: string): number {
    return this.vocabToId.get(token) ?? UNK_ID;
  }

  public getTokenFromId(id: number): string {
    return this.idToVocab.get(id) ?? UNK_TOKEN;
  }
}

export const defaultTokenizer = new FastTokenizer();
