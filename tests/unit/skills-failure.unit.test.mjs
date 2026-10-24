import assert from "node:assert/strict";
import { defaultSkillRegistry, defaultSkillRouter } from "../../dist/core/skills/index.js";
import { BrowserSkill } from "../../dist/core/skills/modules/browser/browserSkill.js";
import { OpenAppSkill } from "../../dist/core/skills/modules/openApp/openAppSkill.js";

console.log("=== Strict Unit Tests: Skills & Failure Handling ===");

// 1. URL Protocol Validation: Reject dangerous or unsupported protocols
const browserSkill = new BrowserSkill();

const invalidProtocols = [
  "ftp://files.example.com",
  "file:///etc/passwd",
  "javascript:alert(1)",
  "data:text/html,<h1>test</h1>",
  "shell:startup",
  "",
  "   ",
];

for (const badUrl of invalidProtocols) {
  const validation = browserSkill.validate({ action: "navigate", url: badUrl });
  if (validation.valid && validation.data) {
    const execResult = await browserSkill.execute(validation.data, {
      platform: "linux",
      isWsl: false,
      timestamp: Date.now(),
    });
    assert.equal(execResult.success, false, `Must reject dangerous URL: "${badUrl}"`);
  } else {
    assert.equal(validation.valid, false, `Validation must fail for invalid URL: "${badUrl}"`);
  }
}
console.log("PASS URL security & protocol validation rejects dangerous protocols");

// 2. Explicit Opener Failure Detection: When OS browser fails to open, skill MUST report failure
const failingContext = {
  platform: "linux",
  isWsl: false,
  timestamp: Date.now(),
  urlOpener: async () => ({
    success: false,
    message: "Failed to open browser: no display socket or default browser found.",
  }),
};

const failExecution = await browserSkill.execute(
  { action: "navigate", url: "https://www.youtube.com" },
  failingContext
);

assert.equal(failExecution.success, false, "When browser opener fails, execution MUST return success: false");
assert.ok(
  failExecution.message.includes("Failed to open browser"),
  "Failure message must be preserved and bubbled up to the user"
);
console.log("PASS browser opener failures are accurately caught and reported");

// 3. Unknown App Failure Detection
const openAppSkill = new OpenAppSkill();
const unknownAppResult = await openAppSkill.execute(
  { target: "non_existent_fake_app_xyz" },
  { platform: "linux", isWsl: false, timestamp: Date.now() }
);
assert.equal(unknownAppResult.success, false, "Non-existent app must report success: false");
assert.ok(
  unknownAppResult.message.includes("I don't know how to open"),
  "Message must indicate app is unknown"
);
console.log("PASS unknown application execution reports explicit failure");

// 4. Missing Parameters Rejection
const emptyAppParam = openAppSkill.validate({});
assert.equal(emptyAppParam.valid, false, "Empty parameter object must fail validation");

const emptyBrowserParam = browserSkill.validate({ action: "search", query: "" });
assert.equal(emptyBrowserParam.valid, false, "Empty search query must fail validation");

// 5. Unknown Skill Routing Failure
const badRoute = await defaultSkillRouter.route("someFakeSkillName", {});
assert.equal(badRoute.success, false, "Routing to unregistered skill must fail");
assert.equal(badRoute.error?.code, "SKILL_NOT_FOUND");
console.log("PASS parameter validation gate and unknown skill routing");
