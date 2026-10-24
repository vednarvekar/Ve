import assert from "node:assert/strict";
import { executeUserInput } from "../../dist/core/intentParser/index.js";
import { defaultSLMParser } from "../../dist/core/slm/slmIntentParser.js";

console.log("=== Strict Integration Tests: End-to-End User Execution ===");

// 1. Natural Language Greeting Intent (Handled by SLM)
const greetingResult = await executeUserInput("hi");
assert.equal(greetingResult.success, true);
assert.ok(greetingResult.message.includes("Hey!"), "Greeting must return conversational reply");

const morningResult = await executeUserInput("good morning");
assert.equal(morningResult.success, true);
assert.ok(morningResult.message.includes("Hey!"), "Time-based greeting must be recognized by SLM");
console.log("PASS conversational greetings classified and answered by SLM");

// 2. Web Navigation: "open youtube" must be recognized as browser navigation
const ytResult = await executeUserInput("open youtube");
assert.equal(ytResult.command?.skill, "browser", "Must route to browser skill");
assert.equal((ytResult.command?.params).action, "navigate");
assert.ok(
  String((ytResult.command?.params).url).toLowerCase().includes("youtube"),
  "Target must be youtube"
);
console.log("PASS 'open youtube' accurately identified as browser navigation");

// 3. Application Launch: "open chrome" must be recognized as desktop application
const chromeResult = await executeUserInput("open chrome");
assert.equal(chromeResult.command?.skill, "openApp", "Must route to openApp skill, NOT browser");
assert.equal((chromeResult.command?.params).target, "chrome");
console.log("PASS 'open chrome' accurately identified as native app launch");

// 4. Web Search: "search quantum computing on google"
const searchResult = await executeUserInput("search quantum computing on google");
assert.equal(searchResult.command?.skill, "browser", "Must route to browser skill for search");
assert.equal((searchResult.command?.params).action, "search");
assert.ok(
  String((searchResult.command?.params).query).toLowerCase().includes("quantum computing"),
  "Search query must be extracted properly"
);
console.log("PASS multi-word web search with provider extracted properly");

// 5. WhatsApp Intent: "text alex saying see you at 5"
const whatsAppResult = await executeUserInput("text alex saying see you at 5");
assert.equal(whatsAppResult.command?.skill, "whatsApp");
assert.equal((whatsAppResult.command?.params).recipientName, "alex");
assert.equal((whatsAppResult.command?.params).message, "see you at 5");
console.log("PASS WhatsApp message intent with recipient and message body extraction");

// 6. Unknown / Low-Confidence Input Resilience
const gibberishResult = await executeUserInput("asdfghjkl qwertyuiop 12345");
assert.equal(gibberishResult.success, false, "Gibberish must fail gracefully");
assert.ok(
  gibberishResult.message.includes("didn’t catch that") || gibberishResult.message.includes("I can do this locally"),
  "Must return helpful guidance, never throw an uncaught exception"
);
console.log("PASS low-confidence and malformed input handles safely without crashes");
