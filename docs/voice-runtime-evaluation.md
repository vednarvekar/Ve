# Local voice runtime evaluation

**Status:** English is the user-selected first benchmark language; Windows x64 and Linux x64 are the user-selected benchmark targets (2026-10-29). Research shortlist only; no recognizer has been selected. Live measurements on Ve's target computer and consented speech are required before Step 1.4 can be marked complete.

## Recommendation before measurement

Keep `sherpa-onnx-node` with streaming Zipformer English 20M int8 as the first implementation candidate for the selected English benchmark. It fits the existing Node/Electron stack, exposes streaming recognition, and its int8 encoder/decoder/joiner files total about 43.6 MB. The upstream model page identifies it as English-only and trained on LibriSpeech, so its performance on the user's accent and Ve command names is unknown. Treat this as a candidate, not a decision.

Keep Vosk small US English and Whisper tiny.en as English baselines. Include Vosk small Indian English only if the user wants it as an accent comparison; do not infer the user's accent from the development environment. Its published score is corpus-specific and weak, so it must earn inclusion through the Ve command set. Whisper tiny.en is a useful English accuracy comparison, but its 75 MiB model and native integration make it a less obvious low-overhead Electron choice. Hindi is outside the first benchmark scope.

## Candidate comparison

| Candidate | Published footprint / capability | Advantages | Risks to measure |
|---|---|---|---|
| sherpa-onnx-node + Zipformer English 20M int8 | About 43.6 MB across int8 encoder, decoder, joiner; streaming | Native Node API; online recognition; npm package lists Linux x64, Windows x64, macOS x64/arm64; optional `node-cpal` microphone input | English-only LibriSpeech training; small-model accuracy warning; Linux shared-library path setup; Electron ASAR/native packaging and microphone capture unverified |
| Vosk small US English | 40 MB model; streaming API; published WER 9.85 on LibriSpeech test-clean and 10.38 on TEDLIUM | Offline; Node bindings; Apache 2.0 model listing; lightweight runtime option | US English accent mismatch risk; scores are not Ve-command results; runtime memory and Electron packaging need measurement |
| Vosk small Indian English | 36 MB model; published WER 49.05 on NPTEL Pure | Direct accent comparison candidate | That published score is weak and corpus-specific; evaluate carefully before considering shipping |
| whisper.cpp tiny.en | 75 MiB model; English-only variant | MIT code and weights; mature C/C++ implementation; useful independent English baseline | Adds a C/C++ runtime or native wrapper to Electron; model is larger than the Zipformer int8 files; streaming behavior and package size need measurement |

Published model sizes and benchmark scores are source-reported, not Ve measurements. The models were tested on different datasets and setups; use them to scope the shortlist, not rank accuracy.

## Benchmark procedure

1. Record each target machine and platform: OS/version, CPU model/core count, RAM, architecture, microphone, and Electron version. Run Windows x64 and native Linux x64 checks separately. WSL2 is useful as a development smoke environment, but does not count as native Linux or Windows packaging evidence.
2. Use English for this benchmark. Include the user's ordinary spoken English and product/app names; score any code-switched speech separately as exploratory until support for those languages is specified.
3. Prepare a fixed, consented set of short Ve commands covering app/site launch, media requests, file lookup/opening, and message drafting. Include similar-sounding pairs, product/app names, silence, and ordinary room noise. Store audio only in a temporary local benchmark directory; never commit recordings or transcripts.
4. Run each candidate on identical clips and settings. Run each model once to warm it, then make three measured passes. Record model/runtime versions, checksums, thread count, and whether decode is streaming or full-utterance.
5. Record word error rate (WER; CER for Hindi where useful), exact intent and critical-slot match, incorrectly recognized actionable intent rate, silence/noise false-transcript rate, time to first partial and final transcript, real-time factor, peak RSS, steady CPU, model disk size, installed runtime size, and cold/warm startup.
6. Verify offline behavior with network disabled. Verify native packaging on the actual target OS, including microphone permission, startup, model lookup outside or inside ASAR, and clean shutdown.
7. Keep transcripts in an editable composer. Never route a transcript straight to an executor. The user must press Send; execution must still pass the same command policy as typed input.
8. Record raw results, limitations, and a decision in this document. If the target OS, language, or licensing is unresolved, leave Step 1.4 open.

### English prompt set (draft)

Use these only if English is included in the first-release language set. The speaker reads the sentence naturally without seeing candidate output. These prompts evaluate transcription and extraction of key words only; they do not authorize Ve to perform any action.

| ID | Spoken prompt | Critical words / slots to score |
|---|---|---|
| E01 | Open Calculator. | app = Calculator |
| E02 | Open Chrome. | app = Chrome |
| E03 | Open YouTube. | site = YouTube |
| E04 | Search YouTube for beginner guitar lessons. | site = YouTube; query = beginner guitar lessons |
| E05 | Find where The Mentalist is streaming. | title = The Mentalist |
| E06 | Play Blinding Lights on Spotify. | track = Blinding Lights; app = Spotify |
| E07 | Play my focus playlist on Spotify. | playlist = focus; app = Spotify |
| E08 | Find a podcast about sleep. | media type = podcast; query = sleep |
| E09 | Find my most recent PDF. | file type = PDF; recency = most recent |
| E10 | Open the file named invoice April twenty twenty-six dot PDF. | filename = invoice April 2026.pdf |
| E11 | Show the pictures in Downloads. | file type = images; folder = Downloads |
| E12 | Open the screenshot I saved yesterday. | file type = screenshot; recency = yesterday |
| E13 | Draft a WhatsApp message to Sam saying, "I'll arrive in ten minutes." | app = WhatsApp; recipient = Sam; message = I'll arrive in ten minutes |
| E14 | Prepare to send invoice dot PDF to Sam on WhatsApp. | filename = invoice.pdf; recipient = Sam; app = WhatsApp |
| E15 | Search Netflix for The Mentalist. | site = Netflix; title = The Mentalist |
| E16 | Open Spotify and search for calm instrumental music. | app = Spotify; query = calm instrumental music |
| E17 | Open the latest PDF in Downloads. | file type = PDF; folder = Downloads; recency = latest |
| E18 | Go to netflix dot com. | URL = netflix.com |
| E19 | Cancel. | cancel intent |
| E20 | What can you do? | help intent |

Record two natural takes per prompt in quiet conditions and two in ordinary room noise, if the speaker agrees. Add other speakers only with their explicit consent. Before scoring, keep a copy of the reference text and score files separate from the recognizer output. English is the initial benchmark scope; any Hindi or code-switched examples are exploratory and do not count against the English-only release target.

For negative audio controls, include at least ten seconds each of room noise and silence. The UI must still require push-to-talk and explicit Send; record whether the recognizer produces text, but count no transcript as an action because execution is out of scope for this benchmark.

### Per-clip score template

| Clip ID | Candidate / version | Reference text | Transcript | WER | Intent exact? | Critical slots exact? | Final latency | Peak RSS | Notes |
|---|---|---|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |  |  |  |

### Results

| Field | Result |
|---|---|
| Available benchmark environment | WSL2 x86_64; 11th Gen Intel Core i5-1135G7 (4 cores / 8 threads), 7.6 GiB available memory, Node.js 24.15.0. This is the development host, not a declared release target; WSL microphone and Windows Electron packaging are unverified. |
| Selected benchmark targets | Windows x64 and Linux x64, selected by the user on 2026-10-29 |
| Languages | English first, selected by the user on 2026-10-29; Hindi is out of the first benchmark scope |
| Consented speech set | Not recorded |
| Native packaging checks | Windows x64: pending. Linux x64: pending. WSL2 is not accepted as native Linux packaging evidence. |
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
