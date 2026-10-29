import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  IPC_CAPABILITY_POLICY,
  isRendererCapabilityAllowed,
  trustedRendererUrlsForChannel,
} from "../../dist/main/rendererCapabilityPolicy.js";
import { guardTrustedRendererIpc } from "../../dist/main/ipcSecurity.js";

const urls = {
  chat: "file:///ve/renderer/index.html",
  orb: "file:///ve/renderer/orb.html",
  menu: "file:///ve/renderer/menu.html",
};

assert.deepEqual(IPC_CAPABILITY_POLICY["ve:run-command"], ["chat"]);
assert.equal(isRendererCapabilityAllowed("ve:run-command", "chat"), true);
assert.equal(isRendererCapabilityAllowed("ve:run-command", "orb"), false);
assert.equal(isRendererCapabilityAllowed("ve:list-contacts", "menu"), false);
assert.equal(isRendererCapabilityAllowed("ve:orb-hide", "menu"), true);
assert.equal(isRendererCapabilityAllowed("ve:orb-hide", "chat"), false);
assert.equal(isRendererCapabilityAllowed("ve:orb-drag-position", "orb"), true);
assert.equal(isRendererCapabilityAllowed("ve:orb-drag-position", "menu"), false);
assert.equal(isRendererCapabilityAllowed("ve:unknown", "chat"), false, "unregistered channels fail closed");

assert.deepEqual(trustedRendererUrlsForChannel("ve:orb-hide", urls), [urls.menu]);
assert.deepEqual(trustedRendererUrlsForChannel("ve:orb-menu-visible", urls), [urls.orb, urls.menu]);
assert.deepEqual(trustedRendererUrlsForChannel("ve:run-command", urls), [urls.chat]);
assert.throws(
  () => trustedRendererUrlsForChannel("ve:unknown", urls),
  /No renderer capability policy/,
  "new IPC channels must declare a renderer role before registration"
);

const mainSource = readFileSync(new URL("../../app/main/index.ts", import.meta.url), "utf8");
const preloadSource = readFileSync(new URL("../../app/preload/preload.cts", import.meta.url), "utf8");
const registeredChannels = [
  ...mainSource.matchAll(/registerRendererIpc\("([^"]+)"/g),
  ...mainSource.matchAll(/ipcMain\.on\("([^"]+)"/g),
].map((match) => match[1]).sort();
const exposedChannels = [...preloadSource.matchAll(/ipcRenderer\.(?:invoke|send)\("([^"]+)"/g)]
  .map((match) => match[1]).sort();
assert.deepEqual(registeredChannels, Object.keys(IPC_CAPABILITY_POLICY).sort(), "every main-process channel has an explicit policy");
assert.deepEqual(exposedChannels, Object.keys(IPC_CAPABILITY_POLICY).sort(), "every exposed preload channel has an explicit policy");

let commandInvocations = 0;
const commandGuard = guardTrustedRendererIpc(
  trustedRendererUrlsForChannel("ve:run-command", urls),
  (_event, command) => {
    commandInvocations += 1;
    return command;
  }
);
const chatFrame = { url: urls.chat };
const menuFrame = { url: urls.menu };
assert.equal(commandGuard({ senderFrame: chatFrame, sender: { mainFrame: chatFrame } }, "open calculator"), "open calculator");
assert.throws(
  () => commandGuard({ senderFrame: menuFrame, sender: { mainFrame: menuFrame } }, "open calculator"),
  /untrusted renderer frame/
);
assert.equal(commandInvocations, 1, "a launcher renderer cannot use chat command capabilities");

console.log("PASS IPC capabilities are explicitly scoped to chat, orb, or menu renderers");
