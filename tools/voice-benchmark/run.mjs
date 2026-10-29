#!/usr/bin/env node
import { createRequire } from "node:module";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { calculateWordErrorRate, percentile } from "./metrics.mjs";

const MODEL_FILES = {
  encoder: "encoder-epoch-99-avg-1.int8.onnx",
  decoder: "decoder-epoch-99-avg-1.onnx",
  joiner: "joiner-epoch-99-avg-1.int8.onnx",
  tokens: "tokens.txt",
};

export function parseArgs(args) {
  const options = { repeats: 3, warmups: 1, threads: 1, negativeControl: false };
  const valueOptions = new Set(["--model-dir", "--audio", "--reference", "--repeats", "--warmups", "--threads", "--out"]);
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (key === "--help") return { ...options, help: true };
    if (key === "--negative-control") {
      options.negativeControl = true;
      continue;
    }
    if (!valueOptions.has(key)) throw new Error(`Unknown option: ${key}`);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
    const name = key.slice(2).replace(/-([a-z])/gu, (_match, letter) => letter.toUpperCase());
    options[name] = ["repeats", "warmups", "threads"].includes(name) ? Number(value) : value;
    index += 1;
  }
  for (const required of ["modelDir", "audio", ...(options.negativeControl ? [] : ["reference"])]) {
    if (!options[required]) throw new Error(`Required option missing: --${required.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`);
  }
  if (!Number.isInteger(options.repeats) || options.repeats < 1 || options.repeats > 20) throw new Error("--repeats must be an integer from 1 to 20");
  if (!Number.isInteger(options.warmups) || options.warmups < 0 || options.warmups > 5) throw new Error("--warmups must be an integer from 0 to 5");
  if (!Number.isInteger(options.threads) || options.threads < 1 || options.threads > 16) throw new Error("--threads must be an integer from 1 to 16");
  return options;
}

function assertInputs(options) {
  if (!existsSync(options.audio) || !statSync(options.audio).isFile()) throw new Error(`Audio file not found: ${options.audio}`);
  for (const filename of Object.values(MODEL_FILES)) {
    const fullPath = path.join(options.modelDir, filename);
    if (!existsSync(fullPath) || !statSync(fullPath).isFile()) throw new Error(`Required model file not found: ${fullPath}`);
  }
}

function createRecognizer(modelDir, threads, runtime) {
  return new runtime.OnlineRecognizer({
    featConfig: { sampleRate: 16000, featureDim: 80 },
    modelConfig: {
      transducer: {
        encoder: path.join(modelDir, MODEL_FILES.encoder),
        decoder: path.join(modelDir, MODEL_FILES.decoder),
        joiner: path.join(modelDir, MODEL_FILES.joiner),
      },
      tokens: path.join(modelDir, MODEL_FILES.tokens),
      numThreads: threads,
      provider: "cpu",
    },
    decodingMethod: "greedy_search",
    enableEndpoint: false,
  });
}

function transcribeOne(recognizer, waveform) {
  const startedAt = performance.now();
  const cpuStartedAt = process.cpuUsage();
  const stream = recognizer.createStream();
  const partials = [];
  const samplesPerChunk = Math.max(1, Math.floor(waveform.sampleRate * 0.16));
  let firstPartialComputeMs = null;

  for (let offset = 0; offset < waveform.samples.length; offset += samplesPerChunk) {
    stream.acceptWaveform({
      samples: waveform.samples.subarray(offset, Math.min(offset + samplesPerChunk, waveform.samples.length)),
      sampleRate: waveform.sampleRate,
    });
    while (recognizer.isReady(stream)) {
      recognizer.decode(stream);
      const partial = recognizer.getResult(stream).text.trim();
      if (partial && partial !== partials.at(-1)) {
        partials.push(partial);
        firstPartialComputeMs ??= performance.now() - startedAt;
      }
    }
  }

  stream.inputFinished();
  while (recognizer.isReady(stream)) recognizer.decode(stream);
  const result = recognizer.getResult(stream);
  const elapsedMs = performance.now() - startedAt;
  const cpu = process.cpuUsage(cpuStartedAt);
  return {
    transcript: result.text.trim(),
    partialCount: partials.length,
    firstPartialComputeMs,
    elapsedMs,
    cpuMs: (cpu.user + cpu.system) / 1000,
    realTimeFactor: elapsedMs / (waveform.samples.length / waveform.sampleRate * 1000),
  };
}

function installedRuntimeFootprint(modulePath) {
  const nodeModulesPath = path.dirname(path.dirname(modulePath));
  let totalBytes = 0;
  const pending = [];
  for (const entry of readdirSync(nodeModulesPath, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith("sherpa-onnx-")) pending.push(path.join(nodeModulesPath, entry.name));
  }
  while (pending.length) {
    const directory = pending.pop();
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(fullPath);
      else if (entry.isFile()) totalBytes += statSync(fullPath).size;
    }
  }
  return totalBytes;
}

export async function runBenchmark(options, dependencies = {}) {
  assertInputs(options);
  const startupRssBytes = process.memoryUsage().rss;
  const require = dependencies.require ?? createRequire(import.meta.url);
  const runtime = dependencies.runtime ?? require("sherpa-onnx-node");
  const modulePath = dependencies.modulePath ?? require.resolve("sherpa-onnx-node");
  const runtimeLoadedRssBytes = process.memoryUsage().rss;
  const modelStartedAt = performance.now();
  const recognizer = createRecognizer(options.modelDir, options.threads, runtime);
  const modelLoadMs = performance.now() - modelStartedAt;
  const modelLoadedRssBytes = process.memoryUsage().rss;
  const waveform = runtime.readWave(options.audio);
  if (!waveform.samples?.length || !Number.isFinite(waveform.sampleRate) || waveform.sampleRate < 1) {
    throw new Error("Audio file did not contain a valid waveform");
  }

  const warmupRuns = Array.from({ length: options.warmups }, () => transcribeOne(recognizer, waveform));
  const measuredRuns = Array.from({ length: options.repeats }, () => transcribeOne(recognizer, waveform));
  const finalRssBytes = process.memoryUsage().rss;
  const transcript = measuredRuns.at(-1).transcript;
  const elapsedValues = measuredRuns.map((run) => run.elapsedMs);
  const partialLatencies = measuredRuns.map((run) => run.firstPartialComputeMs).filter(Number.isFinite);
  const report = {
    runtime: "sherpa-onnx-node",
    runtimeVersion: typeof runtime.version === "function" ? runtime.version() : runtime.version ?? "unknown",
    runtimeGitSha: typeof runtime.gitSha1 === "function" ? runtime.gitSha1() : runtime.gitSha1 ?? "unknown",
    nodeVersion: process.version,
    platform: `${process.platform}-${process.arch}`,
    threads: options.threads,
    audioDurationMs: waveform.samples.length / waveform.sampleRate * 1000,
    modelLoadMs,
    modelFilesBytes: Object.values(MODEL_FILES).reduce((total, filename) => total + statSync(path.join(options.modelDir, filename)).size, 0),
    installedRuntimeBytes: installedRuntimeFootprint(modulePath),
    startupRssBytes,
    runtimeLoadedRssBytes,
    modelLoadedRssBytes,
    finalRssBytes,
    warmupCount: warmupRuns.length,
    measuredRuns,
    summary: {
      transcript,
      negativeControl: options.negativeControl,
      wordErrorRate: options.negativeControl ? null : calculateWordErrorRate(options.reference, transcript),
      latencyP50Ms: percentile(elapsedValues, 0.5),
      latencyP95Ms: percentile(elapsedValues, 0.95),
      firstPartialComputeP50Ms: partialLatencies.length ? percentile(partialLatencies, 0.5) : null,
      realTimeFactorP50: percentile(measuredRuns.map((run) => run.realTimeFactor), 0.5),
    },
  };
  return report;
}

const HELP = `Usage: node tools/voice-benchmark/run.mjs --model-dir DIR --audio FILE.wav --reference TEXT [options]

Options:
  --repeats N   Measured passes (default 3, range 1-20)
  --warmups N   Warm-up passes (default 1, range 0-5)
  --threads N   CPU threads (default 1, range 1-16)
  --negative-control  Allow no reference text for silence/noise control clips
  --out FILE    Write JSON results to this path instead of stdout
  --help        Show this help`;

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(HELP);
    } else {
      const report = await runBenchmark(options);
      const output = JSON.stringify(report, null, 2);
      if (options.out) await import("node:fs/promises").then(({ writeFile }) => writeFile(options.out, `${output}\n`, { mode: 0o600 }));
      else console.log(output);
    }
  } catch (error) {
    console.error(`Voice benchmark failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
