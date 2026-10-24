import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_FILES = [
  // 1. Prediction & Federated Learning Math
  path.join(__dirname, "prediction.test.mjs"),
  // 2. Unit Tests
  path.join(__dirname, "unit", "skills-failure.unit.test.mjs"),
  path.join(__dirname, "unit", "slm.unit.test.mjs"),
  path.join(__dirname, "unit", "cross-platform.unit.test.mjs"),
  path.join(__dirname, "storage.test.mjs"),
  // 3. Integration Tests
  path.join(__dirname, "integration", "e2e-execution.integration.test.mjs"),
  path.join(__dirname, "integration", "failure-resilience.integration.test.mjs"),
];

console.log("\n=======================================================");
console.log("      VE STRICT UNIT & INTEGRATION TEST SUITE          ");
console.log("=======================================================\n");

let passedSuites = 0;
let failedSuites = 0;
const overallStart = performance.now();

for (const testFile of TEST_FILES) {
  const relPath = path.relative(__dirname, testFile);
  const suiteStart = performance.now();
  console.log(`\n▶ RUNNING: ${relPath}`);
  try {
    // Dynamic import to execute the test suite
    await import(pathToFileURL(testFile).href);
    const duration = (performance.now() - suiteStart).toFixed(2);
    console.log(`✔ SUITE PASSED (${duration} ms): ${relPath}`);
    passedSuites++;
  } catch (err) {
    const duration = (performance.now() - suiteStart).toFixed(2);
    console.error(`\n✖ SUITE FAILED (${duration} ms): ${relPath}`);
    console.error(err);
    failedSuites++;
  }
}

const totalTime = ((performance.now() - overallStart) / 1000).toFixed(2);
console.log("\n=======================================================");
console.log(`SUMMARY: ${passedSuites} Passed | ${failedSuites} Failed (Total: ${totalTime}s)`);
console.log("=======================================================\n");

if (failedSuites > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
