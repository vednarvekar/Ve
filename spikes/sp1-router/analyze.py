"""SP1 error analysis: per-task TP/FP/FN, top confusions, and the train/dev/test gap."""
import json
from collections import Counter

import run
from run_encoder import EncRouter

MODEL = "sentence-transformers/all-MiniLM-L6-v2"
CONF = 0.8


def counts(router, rows):
    tp, fp, fn, conf = Counter(), Counter(), Counter(), Counter()
    exact = 0
    for item in rows:
        text, labels = item[-2], set(item[-1])
        pred = {str(x) for x in router.predict(text, CONF)}
        exact += pred == labels
        for l in pred & labels:
            tp[l] += 1
        for l in pred - labels:
            fp[l] += 1
        for l in labels - pred:
            fn[l] += 1
        for w in labels - pred:
            for g in pred - labels:
                conf[(w, g)] += 1
    return exact, tp, fp, fn, conf


def main():
    train = [json.loads(l) for l in open(run.ROOT / "data" / "train.jsonl")]
    tests, dev = run.load_tests(), run.load_dev()
    skip = {t[1].lower().strip(" .?!") for t in tests}
    train = [t for t in train if t["text"].lower().strip(" .?!") not in skip]
    r = EncRouter(MODEL, [t["text"] for t in train], [t["labels"][0] for t in train])

    # a held-out slice of the training data, never used to fit, to see how a seen-style sentence scores
    tr_rows = [(t["text"], t["labels"]) for t in train[:600]]
    for name, rows in [("train(first 600)", tr_rows), ("dev", dev), ("doc4 test", tests)]:
        ex = counts(r, rows)[0]
        print(f"{name:16s} exact {ex}/{len(rows)} = {ex / len(rows):.1%}")

    exact, tp, fp, fn, conf = counts(r, tests)
    print("\nPer task on the doc 4 test (labels counted one by one)")
    print("task   TP  FP  FN  precision  recall")
    T = F = N = 0
    for l in sorted(set(tp) | set(fp) | set(fn)):
        p = tp[l] / (tp[l] + fp[l]) if tp[l] + fp[l] else float("nan")
        rc = tp[l] / (tp[l] + fn[l]) if tp[l] + fn[l] else float("nan")
        print(f"{l:5s} {tp[l]:3d} {fp[l]:3d} {fn[l]:3d}   {p:7.0%}   {rc:6.0%}")
        T, F, N = T + tp[l], F + fp[l], N + fn[l]
    print(f"ALL   {T:3d} {F:3d} {N:3d}   {T / (T + F):7.0%}   {T / (T + N):6.0%}")
    print("\nMost common confusions (should be -> got)")
    for (w, g), n in conf.most_common(12):
        print(f"  {w} -> {g}: {n}")


if __name__ == "__main__":
    main()
