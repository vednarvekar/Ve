import assert from "node:assert/strict";
import { guardTrustedRendererIpc, guardTrustedRendererMessage, isBoundedString, isTrustedRendererUrl } from "../../dist/main/ipcSecurity.js";

const trustedUrl = "file:///opt/ve/dist/renderer/index.html";
const mainFrame = { url: trustedUrl };
const trustedEvent = { senderFrame: mainFrame, sender: { mainFrame } };
let handlerCalls = 0;

const guarded = guardTrustedRendererIpc(trustedUrl, (_event, value) => {
  handlerCalls += 1;
  return value;
});

assert.equal(guarded(trustedEvent, "safe"), "safe");
assert.equal(handlerCalls, 1, "trusted main-frame IPC should reach the handler");

const attacks = [
  { senderFrame: { url: "https://attacker.example/" }, sender: { mainFrame: { url: "https://attacker.example/" } } },
  { senderFrame: { url: "file:///opt/ve/dist/renderer/other.html" }, sender: { mainFrame: { url: "file:///opt/ve/dist/renderer/other.html" } } },
  { senderFrame: { url: trustedUrl }, sender: { mainFrame: { url: "file:///opt/ve/dist/renderer/other.html" } } },
  { senderFrame: { url: "file:///opt/ve/dist/renderer/orb.html" }, sender: { mainFrame: { url: "file:///opt/ve/dist/renderer/orb.html" } } },
  { senderFrame: null, sender: { mainFrame } },
];

for (const event of attacks) {
  assert.throws(() => guarded(event, "attack"), /untrusted renderer frame/);
}

assert.equal(handlerCalls, 1, "rejected IPC must never invoke the privileged handler");

let messageCalls = 0;
const guardedMessage = guardTrustedRendererMessage(trustedUrl, (_event, x, y) => {
  messageCalls += 1;
  assert.equal(typeof x, "number");
  assert.equal(typeof y, "number");
});
guardedMessage(trustedEvent, 10, 20);
for (const event of attacks) guardedMessage(event, 10, 20);
assert.equal(messageCalls, 1, "one-way high-frequency movement IPC accepts only the trusted main renderer");

assert.equal(isBoundedString("valid command", 4000), true);
assert.equal(isBoundedString("", 4000), false, "empty text fields are rejected");
assert.equal(isBoundedString("", 4000, true), true, "the command endpoint may return its normal empty-command response");
assert.equal(isBoundedString("x".repeat(4001), 4000, true), false, "oversized IPC strings are rejected");
assert.equal(isBoundedString({ toString: () => "valid" }, 4000), false, "objects cannot masquerade as text payloads");
assert.equal(isTrustedRendererUrl(trustedUrl, trustedUrl), true, "the exact local entry point is trusted");
assert.equal(isTrustedRendererUrl(trustedUrl, "https://attacker.example/"), false, "remote navigation is rejected");
assert.equal(isTrustedRendererUrl([trustedUrl, "file:///opt/ve/dist/renderer/orb.html"], "file:///opt/ve/dist/renderer/orb.html"), true, "an explicitly allowed launcher page is trusted");
assert.equal(isTrustedRendererUrl([trustedUrl, "file:///opt/ve/dist/renderer/orb.html"], "file:///opt/ve/dist/renderer/unknown.html"), false, "other local files are not implicitly trusted");
