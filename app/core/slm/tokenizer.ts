import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TokenizedSequence {
  inputIds: BigInt64Array;
  attentionMask: BigInt64Array;
  tokenTypeIds: BigInt64Array;
  tokens: string[];
}

export class WordPieceTokenizer {
  private vocab: Map<string, number> = new Map();
  private invVocab: Map<number, string> = new Map();
  private maxSeqLen: number;

  public readonly CLS_TOKEN = "[CLS]";
  public readonly SEP_TOKEN = "[SEP]";
  public readonly UNK_TOKEN = "[UNK]";
  public readonly PAD_TOKEN = "[PAD]";

  public readonly CLS_ID: number;
  public readonly SEP_ID: number;
  public readonly UNK_ID: number;
  public readonly PAD_ID: number;

  constructor(vocabPath?: string, maxSeqLen = 64) {
    this.maxSeqLen = maxSeqLen;
    const resolvedPath = vocabPath || path.join(__dirname, "assets", "vocab.txt");

    if (existsSync(resolvedPath)) {
      const content = readFileSync(resolvedPath, "utf-8");
      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const token = lines[i]?.trim();
        if (token) {
          this.vocab.set(token, i);
          this.invVocab.set(i, token);
        }
      }
    } else {
      // Minimal bootstrap fallback
      this.vocab.set("[PAD]", 0);
      this.vocab.set("[UNK]", 100);
      this.vocab.set("[CLS]", 101);
      this.vocab.set("[SEP]", 102);
    }

    this.PAD_ID = this.vocab.get("[PAD]") ?? 0;
    this.UNK_ID = this.vocab.get("[UNK]") ?? 100;
    this.CLS_ID = this.vocab.get("[CLS]") ?? 101;
    this.SEP_ID = this.vocab.get("[SEP]") ?? 102;
  }

  public get vocabSize(): number {
    return this.vocab.size;
  }

  public normalize(text: string): string {
    return text
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  public tokenizeWord(word: string): string[] {
    if (this.vocab.has(word)) return [word];
    const subwords: string[] = [];
    let start = 0;
    while (start < word.length) {
      let end = word.length;
      let curSubstr: string | null = null;
      while (start < end) {
        let substr = word.slice(start, end);
        if (start > 0) substr = `##${substr}`;
        if (this.vocab.has(substr)) {
          curSubstr = substr;
          break;
        }
        end--;
      }
      if (!curSubstr) {
        return [this.UNK_TOKEN];
      }
      subwords.push(curSubstr);
      start = end;
    }
    return subwords;
  }

  public tokenize(text: string): string[] {
    const clean = this.normalize(text);
    if (!clean) return [];
    // Basic word punctuation splitter
    const words = clean.match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]+/gu) || [];
    const tokens: string[] = [];
    for (const word of words) {
      tokens.push(...this.tokenizeWord(word));
    }
    return tokens;
  }

  public encode(text: string): TokenizedSequence {
    const rawTokens = this.tokenize(text);
    // Truncate if necessary (reserve 2 slots for [CLS] and [SEP])
    const maxTokens = this.maxSeqLen - 2;
    const tokens = rawTokens.slice(0, maxTokens);

    const inputIds = new BigInt64Array(this.maxSeqLen).fill(BigInt(this.PAD_ID));
    const attentionMask = new BigInt64Array(this.maxSeqLen).fill(0n);
    const tokenTypeIds = new BigInt64Array(this.maxSeqLen).fill(0n);

    // [CLS]
    inputIds[0] = BigInt(this.CLS_ID);
    attentionMask[0] = 1n;

    for (let i = 0; i < tokens.length; i++) {
      const id = this.vocab.get(tokens[i]!) ?? this.UNK_ID;
      inputIds[i + 1] = BigInt(id);
      attentionMask[i + 1] = 1n;
    }

    // [SEP]
    const sepIndex = tokens.length + 1;
    inputIds[sepIndex] = BigInt(this.SEP_ID);
    attentionMask[sepIndex] = 1n;

    return {
      inputIds,
      attentionMask,
      tokenTypeIds,
      tokens: [this.CLS_TOKEN, ...tokens, this.SEP_TOKEN],
    };
  }

  public decode(ids: BigInt64Array | number[]): string {
    const tokens: string[] = [];
    for (const rawId of ids) {
      const id = Number(rawId);
      if (id === this.PAD_ID || id === this.CLS_ID || id === this.SEP_ID) continue;
      const token = this.invVocab.get(id);
      if (token) tokens.push(token);
    }
    return tokens.join(" ").replace(/ ##/g, "");
  }
}

export const defaultTokenizer = new WordPieceTokenizer();
