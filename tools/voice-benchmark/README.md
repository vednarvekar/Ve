# Ve voice benchmark tool

This is isolated development tooling for evaluating sherpa-onnx on prerecorded WAV files. It is not loaded by the Ve app and does not capture microphone audio.

## Install

```sh
npm --prefix tools/voice-benchmark install
```

This installs the pinned `sherpa-onnx-node` development dependency in this directory only. Model weights are downloaded separately and must not be committed.

## Run

```sh
node tools/voice-benchmark/run.mjs \
  --model-dir /path/to/sherpa-onnx-streaming-zipformer-en-20M-2023-02-17 \
  --audio /path/to/consented-command.wav \
  --reference "Open Spotify" \
  --repeats 3 --warmups 1 --threads 1
```

The WAV reference is the exact spoken sentence. The tool reports transcript, WER, model-load time, decode latency, unpaced first-partial compute time, real-time factor, CPU time, process RSS at startup/runtime/model-load/after-inference, model-file size, and installed runtime-package size. Audio is supplied in 160 ms chunks without real-time pacing, so first-partial timing is a compute metric, not live microphone latency. For human speech benchmarks, use the prompt list and consent/privacy procedure in `docs/voice-runtime-evaluation.md`; never commit audio or private transcripts. For Windows and Linux, install and run this tool natively on each OS. WSL output is labeled `linux-x64` and is not native Linux or Windows packaging evidence.

For silence or room-noise controls that have no reference sentence, add `--negative-control`; WER is omitted and any produced transcript is reported for manual review.

`--out FILE` writes a JSON report with owner-only permissions where the OS supports them; otherwise output is printed to stdout. The model is English-only and recognition never triggers an app action.
