import assert from "node:assert/strict";
import { calculateWordErrorRate, normalizeTranscript } from "../../tools/voice-benchmark/metrics.mjs";
import { parseArgs } from "../../tools/voice-benchmark/run.mjs";

assert.equal(normalizeTranscript("  Open   Netflix! "), "open netflix", "transcript normalization is stable for case, whitespace, and punctuation");
assert.equal(normalizeTranscript("I’ll arrive in ten minutes."), "i'll arrive in ten minutes", "curly apostrophes normalize consistently");
assert.equal(calculateWordErrorRate("open netflix", "Open Netflix"), 0, "identical words have zero WER");
assert.equal(calculateWordErrorRate("open netflix", "open youtube"), 0.5, "WER counts one substitution over two reference words");
assert.equal(calculateWordErrorRate("open netflix", "open the netflix site"), 1, "WER counts insertions over reference length");
assert.equal(calculateWordErrorRate("open netflix", "open"), 0.5, "WER counts deletions over reference length");
assert.throws(() => calculateWordErrorRate("", ""), /reference/i, "WER rejects an empty reference instead of dividing by zero");
assert.deepEqual(parseArgs(["--model-dir", "model", "--audio", "voice.wav", "--reference", "open spotify"]), {
  repeats: 3, warmups: 1, threads: 1, negativeControl: false, modelDir: "model", audio: "voice.wav", reference: "open spotify",
}, "CLI defaults are stable and the required benchmark inputs are parsed");
assert.throws(() => parseArgs(["--audio", "voice.wav"]), /required option missing/i, "CLI rejects incomplete benchmark requests");
assert.throws(() => parseArgs(["--model-dir", "m", "--audio", "a.wav", "--reference", "open app", "--repeats", "0"]), /repeats/i, "CLI rejects invalid repeat counts");
assert.equal(parseArgs(["--model-dir", "m", "--audio", "noise.wav", "--negative-control"]).negativeControl, true, "negative controls do not require a transcription reference");

console.log("PASS voice benchmark transcript metrics");
