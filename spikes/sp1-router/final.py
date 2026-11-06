"""SP1 final report with three separate sets.

train  generated sentences, fits the model
val    my 122 sentences, used only to pick the confidence cutoff
test   129 fresh sentences, scored ONCE, never tuned on
doc4   the doc 4 set, already seen during tuning, reported as a second opinion only
"""
import json
from collections import Counter

import run
from run_encoder import EncRouter

MODEL = "sentence-transformers/all-MiniLM-L6-v2"


def load_txt(name):
    rows = []
    for line in (run.ROOT / "data" / name).read_text().splitlines():
        lab, text = line.split("|", 1)
        rows.append((text, lab.split("+")))
    return rows


def norm(s):
    return s.lower().strip(" .?!")


def evaluate(r, rows, conf):
    exact = tp = fp = fn = 0
    single = [0, 0]
    chain = [0, 0]
    per = Counter()
    for item in rows:
        text, labels = item[-2], set(item[-1])
        pred = {str(x) for x in r.predict(text, conf)}
        hit = pred == labels
        exact += hit
        tp += len(pred & labels)
        fp += len(pred - labels)
        fn += len(labels - pred)
        bucket = chain if len(labels) > 1 else single
        bucket[0] += hit
        bucket[1] += 1
        if not hit:
            per[(tuple(sorted(labels)), tuple(sorted(pred)))] += 1
    return exact, tp, fp, fn, single, chain, per


def show(name, r, rows, conf, detail=False):
    exact, tp, fp, fn, single, chain, per = evaluate(r, rows, conf)
    print(f"{name:5s} exact {exact}/{len(rows)} = {exact / len(rows):.1%}   "
          f"single-task {single[0]}/{single[1]}   chains {chain[0]}/{chain[1]}   "
          f"TP {tp} FP {fp} FN {fn}  precision {tp / (tp + fp):.0%} recall {tp / (tp + fn):.0%}")
    if detail:
        for (want, got), n in per.most_common():
            print(f"      want {list(want)} got {list(got)}")


def main():
    train = [json.loads(l) for l in open(run.ROOT / "data" / "train.jsonl")]
    val, test = load_txt("val.txt"), load_txt("test.txt")
    doc4 = run.load_tests()

    heldout = {norm(t) for t, _ in val} | {norm(t) for t, _ in test} | {norm(t[1]) for t in doc4}
    clean = [t for t in train if norm(t["text"]) not in heldout]
    print(f"train {len(clean)} rows ({len(train) - len(clean)} removed as exact duplicates of val/test/doc4)")
    print(f"overlap val/test: {len({norm(t) for t, _ in val} & {norm(t) for t, _ in test})}   "
          f"test/doc4: {len({norm(t) for t, _ in test} & {norm(t[1]) for t in doc4})}\n")

    r = EncRouter(MODEL, [t["text"] for t in clean], [t["labels"][0] for t in clean])
    conf = max((evaluate(r, val, c)[0], c) for c in [0.3, 0.4, 0.5, 0.6, 0.7, 0.8])[1]
    print(f"cutoff picked on val: {conf}\n")
    show("train", r, [(t["text"], t["labels"]) for t in clean[:600]], conf)
    show("val", r, val, conf)
    show("TEST", r, test, conf, detail=True)
    show("doc4", r, doc4, conf)


if __name__ == "__main__":
    main()
