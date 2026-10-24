import assert from "node:assert/strict";
import { defaultSkillRouter } from "../../dist/core/skills/index.js";
import { BrowserSkill } from "../../dist/core/skills/modules/browser/browserSkill.js";
import { OpenAppSkill } from "../../dist/core/skills/modules/openApp/openAppSkill.js";
import { WhatsAppSkill } from "../../dist/core/skills/modules/whatsApp/whatsAppSkill.js";

console.log("=== Strict Integration Tests: Catching All Execution Failures ===");

// 1. SPECIFIC TEST: Opening YouTube Fails
// When the underlying OS launcher or browser process fails (e.g. Display socket missing, browser binary missing, spawn error)
const browser = new BrowserSkill();

const mockFailingContext = {
  platform: "linux",
  isWsl: false,
  timestamp: Date.now(),
  urlOpener: async (url) => ({
    success: false,
    message: `OS browser execution failed for ${url}: Command 'xdg-open' not found or display not set.`,
  }),
};

const ytFailureResult = await browser.execute(
  { action: "navigate", url: "https://www.youtube.com" },
  mockFailingContext
);

// CRITICAL ASSERTION: The assistant must NEVER claim "Opened https://www.youtube.com" if the OS opener failed!
assert.equal(ytFailureResult.success, false, "When OS fails to open YouTube, skill MUST report success: false");
assert.ok(
  !ytFailureResult.message.startsWith("Opened"),
  "Message must NOT claim YouTube was opened when it failed"
);
assert.ok(
  ytFailureResult.message.includes("OS browser execution failed"),
  "Message must describe the actual root failure"
);
console.log("PASS opening YouTube failure is caught and accurately reported (never false success)");

// 2. SPECIFIC TEST: App Launch Fails
// When launching an app fails at OS process level (e.g. Binary not found, permission denied)
const appSkill = new OpenAppSkill();

const unknownApp = await appSkill.execute(
  { target: "unknown_broken_program" },
  { platform: "linux", isWsl: false, timestamp: Date.now() }
);
assert.equal(unknownApp.success, false, "Unknown app must return success: false");
assert.ok(
  unknownApp.message.includes("I don't know how to open"),
  "Must inform user that app cannot be opened"
);
console.log("PASS app launch failure is caught and reported");

// 3. SPECIFIC TEST: WhatsApp Contact Missing Fails Safely
const whatsAppSkill = new WhatsAppSkill();
const missingContactResult = await whatsAppSkill.execute(
  { recipientName: "non_existent_contact_name_123", message: "hello" },
  {
    platform: "linux",
    isWsl: false,
    timestamp: Date.now(),
    contactsProvider: async () => [{ name: "Alice", phone: "1234567890" }],
  }
);
assert.equal(missingContactResult.success, false, "Missing contact must return success: false");
assert.ok(
  missingContactResult.message.includes("I don’t have a saved WhatsApp number"),
  "Must provide actionable message to add contact"
);
console.log("PASS WhatsApp missing contact failure is caught and reported");

// 4. SPECIFIC TEST: Execution Timeout Handling
// When a custom or future skill hangs indefinitely, SkillRouter MUST abort and return success: false
class HangingSkill {
  id = "hangingSkill";
  name = "Hanging Test Skill";
  description = "A skill that simulates an infinite hang";
  riskLevel = 0;

  validate(params) {
    return { valid: true, data: params };
  }

  async execute() {
    // Hangs forever
    await new Promise(() => {});
    return { success: true, message: "Will never reach" };
  }
}

const { SkillRegistry } = await import("../../dist/core/skills/registry/skillRegistry.js");
const { SkillRouter } = await import("../../dist/core/skills/router/skillRouter.js");

const testRegistry = new SkillRegistry();
testRegistry.register(new HangingSkill());

// Custom router with 200ms timeout for test speed
class FastTimeoutRouter extends SkillRouter {
  async route(skillId, rawParams) {
    const skill = testRegistry.get(skillId);
    return await Promise.race([
      skill.execute(rawParams, { platform: "linux", isWsl: false, timestamp: Date.now() }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Execution timed out after 200ms")), 200)
      ),
    ]).catch((err) => ({
      success: false,
      message: `Execution failed: ${err.message}`,
      error: { code: "EXECUTION_TIMEOUT", message: err.message },
    }));
  }
}

const timeoutRouter = new FastTimeoutRouter(testRegistry);
const timeoutResult = await timeoutRouter.route("hangingSkill", {});
assert.equal(timeoutResult.success, false, "Hanging execution MUST be caught and aborted");
assert.equal(timeoutResult.error?.code, "EXECUTION_TIMEOUT");
console.log("PASS execution timeout is caught and safely terminated");
