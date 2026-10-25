import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rendererCss = readFileSync(new URL("../../app/renderer/orb.css", import.meta.url), "utf8");
const renderer = readFileSync(new URL("../../app/renderer/orb.tsx", import.meta.url), "utf8");
const main = readFileSync(new URL("../../app/main/orbWindow.ts", import.meta.url), "utf8");

assert.match(rendererCss, /\.orb-shell\s*\{[^}]*-webkit-app-region:\s*drag/s, "the orb uses Electron's native draggable window region");
assert.match(rendererCss, /\.orb-action\s*\{[^}]*-webkit-app-region:\s*no-drag/s, "the center action remains clickable inside the native drag region");
assert.doesNotMatch(renderer, /onPointerMove|requestAnimationFrame/, "orb movement is not simulated through renderer pointer IPC");
assert.match(main, /window\.on\("move",\s*\(\)\s*=>\s*\{/s, "native window movement is observed in the main process");
assert.match(main, /menu\.setPosition\(bounds\.x,\s*bounds\.y,\s*false\)/, "the action window follows the orb's native window coordinates");
assert.match(main, /},\s*180\);/, "orb position persistence is debounced until the native drag settles");
