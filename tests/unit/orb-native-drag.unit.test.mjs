import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rendererCss = readFileSync(new URL("../../app/renderer/orb.css", import.meta.url), "utf8");
const renderer = readFileSync(new URL("../../app/renderer/orb.tsx", import.meta.url), "utf8");
const main = readFileSync(new URL("../../app/main/orbWindow.ts", import.meta.url), "utf8");
const appMain = readFileSync(new URL("../../app/main/index.ts", import.meta.url), "utf8");
const chat = readFileSync(new URL("../../app/renderer/App.tsx", import.meta.url), "utf8");

assert.match(rendererCss, /\.orb-shell\s*\{[^}]*-webkit-app-region:\s*drag/s, "the orb uses Electron's native draggable window region");
assert.match(rendererCss, /\.orb-action\s*\{[^}]*-webkit-app-region:\s*no-drag/s, "the center action remains clickable inside the native drag region");
assert.match(renderer, /window\.requestAnimationFrame/, "center-only pointer movement is coalesced to animation frames");
assert.match(main, /window\.on\("move",\s*\(\)\s*=>\s*\{/s, "native window movement is observed in the main process");
assert.match(main, /menu\.setPosition\(bounds\.x,\s*bounds\.y,\s*false\)/, "the action window follows the orb's native window coordinates");
assert.doesNotMatch(main.slice(main.indexOf("export function moveOrb("), main.indexOf("export function saveOrbPosition")), /menu\.setPosition/, "orb movement has one menu-follow path through the native move event");
assert.match(main, /function defaultPosition\(\)[\s\S]*area\.x \+ area\.width - ORB_SIZE - EDGE_MARGIN/, "first launch uses a deterministic visible bottom-right spawn point");
assert.match(main, /},\s*180\);/, "orb position persistence is debounced until the native drag settles");
assert.match(renderer, /onPointerDown=\{startCenterDrag\}/, "the center remains a pointer target for click-versus-drag detection");
assert.match(renderer, /window\.ve\.dragOrb\(/, "center drags use the low-overhead movement bridge");
assert.match(appMain, /ipcMain\.on\("ve:orb-drag-position",\s*guardTrustedRendererMessage/s, "center movement IPC is restricted to the trusted orb renderer");
assert.match(appMain, /ipcMain\.on\("ve:orb-drag-finish",\s*guardTrustedRendererMessage/s, "center-drag completion is restricted to the trusted orb renderer");
assert.match(chat, /Show orb/, "the taskbar chat exposes a visible way back to the floating launcher");
assert.match(chat, /window\.ve\.showOrb\(\)/, "the taskbar action restores the floating launcher");
assert.match(appMain, /registerRendererIpc\("ve:show-orb"[\s\S]*?showOrb\(tray\);[\s\S]*?hidePopup\(\);/, "restoring the orb closes the taskbar chat window");
