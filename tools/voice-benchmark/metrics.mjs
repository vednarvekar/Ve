export function normalizeTranscript(text) {
  return text
    .toLocaleLowerCase("en-US")
    .replace(/[’]/gu, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function calculateWordErrorRate(reference, hypothesis) {
  const expected = normalizeTranscript(reference).split(" ").filter(Boolean);
  const actual = normalizeTranscript(hypothesis).split(" ").filter(Boolean);
  if (expected.length === 0) throw new Error("WER reference must contain at least one word");

  let previous = Array.from({ length: actual.length + 1 }, (_, index) => index);
  for (let row = 1; row <= expected.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= actual.length; column += 1) {
      const substitutionCost = expected[row - 1] === actual[column - 1] ? 0 : 1;
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + substitutionCost
      );
    }
    previous = current;
  }
  return previous[actual.length] / expected.length;
}

export function percentile(values, fraction) {
  if (!Array.isArray(values) || values.length === 0) throw new Error("Cannot calculate percentile from empty values");
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) throw new Error("Percentile fraction must be between 0 and 1");
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(fraction * sorted.length) - 1] ?? sorted[0];
}
