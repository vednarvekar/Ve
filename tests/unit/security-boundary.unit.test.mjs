import assert from "node:assert/strict";
import { defaultSkillRouter } from "../../dist/core/skills/index.js";
import { BrowserSkill } from "../../dist/core/skills/modules/browser/browserSkill.js";
import { buildWhatsAppChatUrl } from "../../dist/core/browser/siteUrls.js";

const browser = new BrowserSkill();
for (const url of [
  "file:///etc/passwd",
  "javascript:alert(1)",
  "data:text/html,hello",
  "ftp://example.com/file",
  "shell:startup",
]) {
  assert.equal(browser.validate({ action: "navigate", url }).valid, false, `unsafe URL rejected: ${url}`);
}

let openedUrl = "";
const search = await browser.execute(
  { action: "search", query: "budget & private", provider: "attacker.example" },
  {
    platform: "linux",
    isWsl: false,
    timestamp: Date.now(),
    urlOpener: async (url) => {
      openedUrl = url;
      return { success: true, message: "opened" };
    },
  }
);
assert.equal(search.success, true);
assert.equal(openedUrl, "https://www.google.com/search?q=budget%20%26%20private");

const shellInjection = await defaultSkillRouter.route("openApp", {
  target: "chrome; rm -rf /",
});
assert.equal(shellInjection.success, false, "unrecognized app strings must not reach an OS launcher");
assert.match(shellInjection.message, /don't know how to open/);

const encodedWhatsApp = buildWhatsAppChatUrl("+1 555 0100", "hello&text=send%20this");
assert.equal(encodedWhatsApp, "https://wa.me/15550100?text=hello%26text%3Dsend%2520this");
