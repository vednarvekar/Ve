# Local voice runtime evaluation

**Status:** Research shortlist only. No recognizer has been selected. Live measurements on Ve's target computer and consented speech are required before Step 1.4 can be marked complete.

## Recommendation before measurement

Keep `sherpa-onnx-node` with streaming Zipformer English 20M int8 as the first implementation candidate only if English is the first supported language. It fits the existing Node/Electron stack, exposes streaming recognition, and its int8 encoder/decoder/joiner files total about 43.6 MB. The upstream model page identifies it as English-only and trained on LibriSpeech, so its performance on the user's accent and Ve command names is unknown. Treat this as a candidate, not a decision.

If Hindi or Indian English is required in the first release, add Vosk's small Hindi and Indian English models to the same test set. Their published scores are from different evaluation corpora and cannot be compared directly with each other, Zipformer, or Whisper. Whisper tiny.en is a useful English accuracy comparison, but its 75 MiB model and native integration make it a less obvious low-overhead Electron choice.

## Candidate comparison

| Candidate | Published footprint / capability | Advantages | Risks to measure |
|---|---|---|---|
| sherpa-onnx-node + Zipformer English 20M int8 | About 43.6 MB across int8 encoder, decoder, joiner; streaming | Native Node API; online recognition; npm package lists Linux x64, Windows x64, macOS x64/arm64; optional `node-cpal` microphone input | English-only LibriSpeech training; small-model accuracy warning; Linux shared-library path setup; Electron ASAR/native packaging and microphone capture unverified |
| Vosk small US English | 40 MB model; streaming API; published WER 9.85 on LibriSpeech test-clean and 10.38 on TEDLIUM | Offline; Node bindings; Apache 2.0 model listing; lightweight runtime option | US English accent mismatch risk; scores are not Ve-command results; runtime memory and Electron packaging need measurement |
| Vosk small Indian English | 36 MB model; published WER 49.05 on NPTEL Pure | Direct accent comparison candidate | That published score is weak and corpus-specific; evaluate carefully before considering shipping |
| Vosk small Hindi | 42 MB model; published WER 20.89 IITM Challenge / 24.72 MUCS Challenge | Adds an offline Hindi candidate; Apache 2.0 listed | Not comparable to English scores; code-switching and app/product names need dedicated testing |
| whisper.cpp tiny.en | 75 MiB model; English-only variant | MIT code and weights; mature C/C++ implementation; useful independent English baseline | Adds a C/C++ runtime or native wrapper to Electron; model is larger than the Zipformer int8 files; streaming behavior and package size need measurement |

Published model sizes and benchmark scores are source-reported, not Ve measurements. The models were tested on different datasets and setups; use them to scope the shortlist, not rank accuracy.

## Benchmark procedure

1. Record the target machine and release platform: OS/version, CPU model/core count, RAM, architecture, microphone, and Electron version. Do not treat WSL results as Windows desktop packaging results.
2. Confirm the first-release language set. Include each requested language and the user's ordinary accent/code-switching in the same comparison.
3. Prepare a fixed, consented set of short Ve commands covering app/site launch, media requests, file lookup/opening, and message drafting. Include similar-sounding pairs, product/app names, silence, and ordinary room noise. Store audio only in a temporary local benchmark directory; never commit recordings or transcripts.
4. Run each candidate on identical clips and settings. Run each model once to warm it, then make three measured passes. Record model/runtime versions, checksums, thread count, and whether decode is streaming or full-utterance.
5. Record word error rate (WER; CER for Hindi where useful), exact intent and critical-slot match, incorrectly recognized actionable intent rate, silence/noise false-transcript rate, time to first partial and final transcript, real-time factor, peak RSS, steady CPU, model disk size, installed runtime size, and cold/warm startup.
6. Verify offline behavior with network disabled. Verify native packaging on the actual target OS, including microphone permission, startup, model lookup outside or inside ASAR, and clean shutdown.
7. Keep transcripts in an editable composer. Never route a transcript straight to an executor. The user must press Send; execution must still pass the same command policy as typed input.
8. Record raw results, limitations, and a decision in this document. If the target OS, language, or licensing is unresolved, leave Step 1.4 open.

### Results

| Field | Result |
|---|---|
| Target machine / OS | Not measured; current repo notes identify WSL2 x86_64, but no release target is declared |
| Languages | Awaiting user's language preference |
| Consented speech set | Not recorded |
| Native packaging checks | Not run |
| Decision | Pending; no voice package or model added |

## Official sources

- [sherpa-onnx JavaScript installation](https://k2-fsa.github.io/sherpa/onnx/javascript-api/install.html): Node versions, supported OS/architectures, native library path, and optional `node-cpal` microphone capture.
- [sherpa-onnx Zipformer model documentation](https://github.com/k2-fsa/sherpa/blob/master/docs/source/onnx/pretrained_models/online-transducer/zipformer-transducer-models.rst): English 20M model training corpus, model files, int8 sizes, and streaming microphone example.
- [Zipformer English 20M model card](https://huggingface.co/csukuangfj/sherpa-onnx-streaming-zipformer-en-20M-2023-02-17): Apache-2.0 metadata for this model artifact. Verify all model files and notices again at the pinned revision before redistribution.
- [Vosk model catalog](https://alphacephei.com/vosk/models): model sizes, dataset-specific scores, and per-model licenses, including small Indian English and Hindi models.
- [Vosk API repository](https://github.com/alphacep/vosk-api): offline/streaming API and language bindings.
- [whisper.cpp model table](https://github.com/ggml-org/whisper.cpp/blob/master/models/README.md): model disk sizes and `.en` language notes.
- [OpenAI Whisper repository](https://github.com/openai/whisper): Whisper code and model weights are MIT-licensed; verify the exact converted model artifact's notices when packaging.

## Implementation boundary for the later voice step

The recognizer must stay outside the renderer's privileged boundary. Microphone capture is explicit push-to-talk, stops on release/cancel/timeout, does not persist raw audio, and writes only an editable draft transcript. Recognition confidence or transcript text cannot authorize execution. Step 2.9 may implement voice only after this decision and the command-policy boundary are in place.
