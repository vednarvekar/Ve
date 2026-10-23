import assert from "node:assert/strict";
import { defaultSkillRegistry } from "../dist/core/skills/index.js";
import { defaultSkillRouter } from "../dist/core/skills/index.js";
import { buildSearchUrl, normalizeBrowserTarget } from "../dist/core/skills/index.js";

console.log("Running Skills & Router tests...");

// 1. Registry verification
assert.ok(defaultSkillRegistry.has("openApp"), "openApp skill should be registered");
assert.ok(defaultSkillRegistry.has("browser"), "browser skill should be registered");
assert.ok(defaultSkillRegistry.has("whatsApp"), "whatsApp skill should be registered");

const skillsList = defaultSkillRegistry.listSkills();
assert.ok(skillsList.length >= 3, "At least 3 core skills must be registered");

// 2. Browser Search Providers URL tests
const ytUrl = buildSearchUrl("lofi beats", "youtube");
assert.equal(ytUrl, "https://www.youtube.com/results?search_query=lofi%20beats");

const netflixUrl = buildSearchUrl("stranger things", "netflix");
assert.equal(netflixUrl, "https://www.netflix.com/search?q=stranger%20things");

const githubUrl = buildSearchUrl("electron", "github");
assert.equal(githubUrl, "https://github.com/search?q=electron");

// 3. Domain alias normalization
assert.equal(normalizeBrowserTarget("youtube"), "https://www.youtube.com");
assert.equal(normalizeBrowserTarget("github"), "https://github.com");
assert.equal(normalizeBrowserTarget("reddit.com"), "https://reddit.com");

// 4. Browser Skill Validation Gate test
const invalidBrowser = await defaultSkillRouter.route("browser", { action: "invalid" });
assert.equal(invalidBrowser.success, false, "Invalid browser action must fail validation");
assert.equal(invalidBrowser.error?.code, "VALIDATION_FAILED");

const emptySearch = await defaultSkillRouter.route("browser", { action: "search", query: "" });
assert.equal(emptySearch.success, false, "Empty search query must fail validation");

// 5. OpenApp Parameter Validation Gate
const invalidAppResult = await defaultSkillRouter.route("openApp", {});
assert.equal(invalidAppResult.success, false, "Empty app target must fail validation");
assert.equal(invalidAppResult.error?.code, "VALIDATION_FAILED");

// 6. Legacy Route Alias Compatibility test (e.g. "openUrl", "webSearch", "netflixSearch")
const legacyUrlResult = await defaultSkillRouter.route("openUrl", { url: "" });
assert.equal(legacyUrlResult.success, false, "Empty legacy openUrl must fail validation");

const legacySearch = await defaultSkillRouter.route("webSearch", { query: "" });
assert.equal(legacySearch.success, false, "Empty legacy webSearch must fail validation");

// 7. Unknown Skill Routing test
const unknownResult = await defaultSkillRouter.route("nonExistentSkill", {});
assert.equal(unknownResult.success, false, "Unknown skill must fail");
assert.equal(unknownResult.error?.code, "SKILL_NOT_FOUND");

console.log("PASS modular skill registry, browser providers, and validation gate work as expected");
