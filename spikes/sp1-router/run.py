"""SP1 router: train on generated data, tune on my own dev set, score once on doc 4.

Chained requests are split at "and", "then" and commas. Each part is
classified on its own. The split is used only when every part is confident.
"""
import json
import re
import sys
import time
from pathlib import Path

import numpy as np
from scipy.sparse import hstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

ROOT = Path(__file__).parent
DOC = ROOT.parents[1] / "docs" / "4 - Success Metrics and Test Set.md"
QUOTE = re.compile(r"[“\"](.*?)[”\"]")
SPLIT = re.compile(r"\s*(?:,\s*then\s+|\s+and\s+then\s+|\s+then\s+|\s+after that\s+|,\s+and\s+|,\s*|\s+and\s+|\s+&\s+)", re.I)


def load_tests():
    tests = []
    for line in DOC.read_text().splitlines():
        m = re.match(r"\| T(\d+) \| (.*)", line)
        if not m:
            continue
        n = int(m.group(1))
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if n > 90 or 65 <= n <= 73:
            continue
        q = QUOTE.search(cells[1])
        if not q:
            continue
        labels = ["OUT"] if (n >= 83 or n == 74) else [x.strip() for x in cells[-1].split(",")]
        tests.append((n, q.group(1), labels))
    return tests


def load_dev():
    rows = []
    for line in (ROOT / "data" / "dev.txt").read_text().splitlines():
        lab, text = line.split("|", 1)
        rows.append((text, lab.split("+")))
    return rows


class Router:
    def __init__(self, texts, labels):
        self.word = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)
        self.char = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), sublinear_tf=True)
        X = self.vec(texts, fit=True)
        self.clf = LogisticRegression(C=30, max_iter=3000).fit(X, labels)

    def vec(self, texts, fit=False):
        if fit:
            return hstack([self.word.fit_transform(texts), self.char.fit_transform(texts)]).tocsr()
        return hstack([self.word.transform(texts), self.char.transform(texts)]).tocsr()

    def top(self, texts):
        p = self.clf.predict_proba(self.vec(texts))
        i = p.argmax(1)
        return [(self.clf.classes_[k], row[k]) for row, k in zip(p, i)]

    def predict(self, text, conf):
        parts = [p for p in SPLIT.split(text) if p.strip()]
        whole = self.top([text])[0][0]
        if len(parts) > 1:
            res = self.top(parts)
            labs = {l for l, _ in res}
            if all(c >= conf for _, c in res) and "OUT" not in labs and len(labs) > 1:
                return labs
        return {whole}


def score(router, rows, conf):
    ok, wrong = 0, []
    for item in rows:
        text, labels = item[-2], item[-1]
        pred = router.predict(text, conf)
        if pred == set(labels):
            ok += 1
        else:
            wrong.append((item[0] if len(item) == 3 else "", text, sorted(labels), sorted(pred)))
    return ok, wrong


def main():
    train = [json.loads(l) for l in open(ROOT / "data" / "train.jsonl")]
    tests = load_tests()
    dev = load_dev()
    test_texts = {t[1].lower().strip(" .?!") for t in tests}
    train = [t for t in train if t["text"].lower().strip(" .?!") not in test_texts]
    router = Router([t["text"] for t in train], [t["labels"][0] for t in train])

    best = max((score(router, dev, c)[0], c, c) for c in [0.2, 0.3, 0.4, 0.5, 0.6, 0.7])
    conf = best[2]
    ok, wrong = score(router, dev, conf)
    print(f"train rows: {len(train)}  confidence cutoff picked on dev: {conf}")
    print(f"DEV   {ok}/{len(dev)} = {ok / len(dev):.1%}")
    if "--dev" in sys.argv:
        for w in wrong:
            print("  ", w[1], "want", w[2], "got", w[3])
        return

    start = time.perf_counter()
    for t in tests:
        router.predict(t[1], conf)
    ms = (time.perf_counter() - start) / len(tests) * 1000
    ok, wrong = score(router, tests, conf)
    print(f"TEST  {ok}/{len(tests)} = {ok / len(tests):.1%}   avg {ms:.1f} ms per request")
    for w in wrong:
        print(f"  T{w[0]:02d} {w[1]!r} want={w[2]} got={w[3]}")


if __name__ == "__main__":
    main()
