import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function discoverTests(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return discoverTests(fullPath);
      return entry.isFile() && entry.name.endsWith(".test.mjs") ? [fullPath] : [];
    });
}

const TEST_FILES = discoverTests(__dirname);
if (TEST_FILES.length === 0) throw new Error("No test files were discovered.");

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
