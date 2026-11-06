"""SP1 with a small pre-trained encoder (ONNX via fastembed) + a simple classifier head.

Models are picked on the dev set only. The doc 4 test is scored once, for the winner.
"""
import json
import resource
import sys
import time

import numpy as np
from fastembed import TextEmbedding
from sklearn.linear_model import LogisticRegression

import run

MODELS = ["BAAI/bge-small-en-v1.5", "sentence-transformers/all-MiniLM-L6-v2", "snowflake/snowflake-arctic-embed-xs"]


class EncRouter:
    def __init__(self, model, texts, labels):
        self.enc = TextEmbedding(model, threads=4)
        self.cache = {}
        X = self.embed(texts)
        self.clf = LogisticRegression(C=30, max_iter=3000).fit(X, labels)

    def embed(self, texts):
        todo = [t for t in dict.fromkeys(texts) if t not in self.cache]
        if todo:
            for t, v in zip(todo, self.enc.embed(todo, batch_size=64)):
                self.cache[t] = v
        return np.array([self.cache[t] for t in texts])

    def top(self, texts):
        p = self.clf.predict_proba(self.embed(texts))
        i = p.argmax(1)
        return [(self.clf.classes_[k], row[k]) for row, k in zip(p, i)]

    predict = run.Router.predict


def main():
    train = [json.loads(l) for l in open(run.ROOT / "data" / "train.jsonl")]
    tests = run.load_tests()
    dev = run.load_dev()
    test_texts = {t[1].lower().strip(" .?!") for t in tests}
    train = [t for t in train if t["text"].lower().strip(" .?!") not in test_texts]
    texts, labels = [t["text"] for t in train], [t["labels"][0] for t in train]

    results = {}
    for m in MODELS:
        r = EncRouter(m, texts, labels)
        best = max((run.score(r, dev, c)[0], c) for c in [0.3, 0.4, 0.5, 0.6, 0.7, 0.8])
        results[m] = (best[0], best[1], r)
        print(f"{m}: DEV {best[0]}/{len(dev)} = {best[0] / len(dev):.1%} at cutoff {best[1]}")

    name = max(results, key=lambda k: results[k][0])
    ok_dev, conf, r = results[name]
    print(f"\nwinner on dev: {name}")
    if "--dev" in sys.argv:
        return
    ok, wrong = run.score(r, tests, conf)
    print(f"TEST {ok}/{len(tests)} = {ok / len(tests):.1%}")
    for w in wrong:
        print(f"  T{w[0]:02d} {w[1]!r} want={w[2]} got={w[3]}")

    # speed is measured on fresh text so the embedding cache does not help
    r.cache.clear()
    start = time.perf_counter()
    for t in tests:
        r.cache.clear()
        r.predict(t[1], conf)
    print(f"avg {(time.perf_counter() - start) / len(tests) * 1000:.1f} ms per request (incl. encoder)")
    print(f"peak memory of this whole script: {resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024:.0f} MB")


if __name__ == "__main__":
    main()
