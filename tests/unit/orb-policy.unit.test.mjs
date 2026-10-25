import assert from "node:assert/strict";
import { clampOrbPosition, didPointerMoveBeyondThreshold, hideLauncherUsesTaskbarFallback, isWslEnvironment, launcherMenuBounds, visibleWorkArea } from "../../dist/main/orbPolicy.js";

const workArea = { x: 0, y: 0, width: 1920, height: 1080 };

assert.deepEqual(clampOrbPosition({ x: 200, y: 300 }, workArea, 68), { x: 200, y: 300 }, "valid saved positions are retained");
assert.deepEqual(clampOrbPosition({ x: -200, y: -100 }, workArea, 68), { x: 8, y: 8 }, "positions clamp inside the top-left work area");
assert.deepEqual(clampOrbPosition({ x: 4000, y: 4000 }, workArea, 68), { x: 1844, y: 1004 }, "positions clamp inside the bottom-right work area");
assert.deepEqual(clampOrbPosition({ x: 4000, y: 4000 }, { x: 0, y: 0, width: 1920, height: 1032 }, 68), { x: 1844, y: 956 }, "the orb stays above the reserved WSL taskbar region");
assert.deepEqual(clampOrbPosition({ x: -3000, y: 0 }, { x: -1920, y: 0, width: 1920, height: 1080 }, 68), { x: -1912, y: 8 }, "negative-coordinate displays are supported");
assert.deepEqual(clampOrbPosition({ x: 0, y: 0 }, { x: 0, y: 0, width: 40, height: 40 }, 68), { x: 8, y: 8 }, "tiny work areas still return a visible anchor point");

assert.deepEqual(launcherMenuBounds({ x: 300, y: 300 }, workArea), { x: 368, y: 297, width: 204, height: 74 }, "the actions menu touches and centers on the orb");
assert.deepEqual(launcherMenuBounds({ x: 1844, y: 956 }, workArea), { x: 1640, y: 953, width: 204, height: 74 }, "the menu flips to the orb's left near the right display edge");
assert.deepEqual(launcherMenuBounds({ x: 400, y: 400 }, workArea).x, launcherMenuBounds({ x: 500, y: 400 }, workArea).x - 100, "the menu tracks the orb position while it moves");

assert.equal(didPointerMoveBeyondThreshold(3, 3), false, "small pointer motion stays a click");
assert.equal(didPointerMoveBeyondThreshold(4, 4), true, "movement beyond threshold becomes a drag");
assert.equal(didPointerMoveBeyondThreshold(10, 0, 12), false, "configurable drag threshold is respected");
assert.equal(hideLauncherUsesTaskbarFallback("linux"), true, "hiding the orb keeps Ve available on the Linux taskbar");
assert.equal(hideLauncherUsesTaskbarFallback("win32"), false, "Windows can hide the orb to its system tray");
assert.equal(isWslEnvironment({ WSL_DISTRO_NAME: "Ubuntu" }, "Linux"), true, "WSL environment variables identify WSL");
assert.equal(isWslEnvironment({}, "Linux version 6.6.87.2-microsoft-standard-WSL2"), true, "the Linux kernel identifies WSL when host variables are missing");
assert.deepEqual(
  visibleWorkArea({ x: 0, y: 0, width: 1920, height: 1080 }, { x: 0, y: 0, width: 1920, height: 1080 }, true),
  { x: 0, y: 0, width: 1920, height: 1032 },
  "the visible WSL work area excludes the Windows taskbar when Electron reports full display bounds"
);
assert.deepEqual(
  visibleWorkArea({ x: 0, y: 0, width: 1920, height: 1032 }, { x: 0, y: 0, width: 1920, height: 1080 }, true),
  { x: 0, y: 0, width: 1920, height: 1032 },
  "an already reduced work area is not inset twice"
);
