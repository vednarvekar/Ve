import assert from "node:assert/strict";
import { OpenAppSkill, APP_ALIASES } from "../../dist/core/skills/modules/openApp/openAppSkill.js";
import { BrowserSkill } from "../../dist/core/skills/modules/browser/browserSkill.js";
import { getStorageDirectory, getDatabasePath } from "../../dist/core/storage/sqliteStore.js";

console.log("=== Strict Cross-Platform Unit Tests (Windows, macOS, Linux) ===");

const openApp = new OpenAppSkill();
const browser = new BrowserSkill();

// 1. App Aliases completeness for all target OS platforms
for (const [key, spec] of Object.entries(APP_ALIASES)) {
  assert.ok(spec.win, `App "${key}" must define a Windows command`);
  assert.ok(spec.mac, `App "${key}" must define a macOS application name`);
  assert.ok(spec.linux, `App "${key}" must define a Linux binary name`);
  assert.ok(spec.canonicalId, `App "${key}" must define a canonical identifier`);
}
console.log(`PASS verified ${Object.keys(APP_ALIASES).length} app aliases across Windows, macOS, and Linux`);

// 2. Windows Platform Simulation (win32, native)
// Mock the executor to capture commands dispatched on Windows
let lastDispatchedCommand = null;

const windowsContext = {
  platform: "win32",
  isWsl: false,
  timestamp: Date.now(),
  urlOpener: async (url) => {
    lastDispatchedCommand = { type: "url", url, platform: "win32" };
    return { success: true, message: `Opened ${url}` };
  },
};

// Test Windows URL navigation
const winBrowserRes = await browser.execute(
  { action: "navigate", url: "https://www.youtube.com" },
  windowsContext
);
assert.equal(winBrowserRes.success, true);
assert.equal(lastDispatchedCommand?.platform, "win32");
assert.equal(lastDispatchedCommand?.url, "https://www.youtube.com");
console.log("PASS native Windows browser URL dispatch");

// 3. macOS Platform Simulation (darwin)
const macContext = {
  platform: "darwin",
  isWsl: false,
  timestamp: Date.now(),
  urlOpener: async (url) => {
    lastDispatchedCommand = { type: "url", url, platform: "darwin" };
    return { success: true, message: `Opened ${url}` };
  },
};

const macBrowserRes = await browser.execute(
  { action: "navigate", url: "https://github.com" },
  macContext
);
assert.equal(macBrowserRes.success, true);
assert.equal(lastDispatchedCommand?.platform, "darwin");
assert.equal(lastDispatchedCommand?.url, "https://github.com");
console.log("PASS macOS browser URL dispatch");

// 4. Linux Platform Simulation (native linux)
const linuxContext = {
  platform: "linux",
  isWsl: false,
  timestamp: Date.now(),
  urlOpener: async (url) => {
    lastDispatchedCommand = { type: "url", url, platform: "linux" };
    return { success: true, message: `Opened ${url}` };
  },
};

const linuxBrowserRes = await browser.execute(
  { action: "navigate", url: "https://reddit.com" },
  linuxContext
);
assert.equal(linuxBrowserRes.success, true);
assert.equal(lastDispatchedCommand?.platform, "linux");
console.log("PASS Linux browser URL dispatch");

// 5. Cross-Platform Storage Directory Resolution
// Simulate Windows environment variables
const originalEnv = { ...process.env };
try {
  // Test Windows %USERPROFILE% resolution
  process.env.USERPROFILE = "C:\\Users\\TestWindowsUser";
  delete process.env.HOME;
  delete process.env.TEST_USER_DATA_DIR;
  delete process.env.VE_STORAGE_DIR;

  const winStorageDir = getStorageDirectory();
  assert.ok(
    winStorageDir.includes("TestWindowsUser") || winStorageDir.includes(".ve"),
    `Storage directory on Windows must resolve user path (got ${winStorageDir})`
  );

  const winDbPath = getDatabasePath();
  assert.ok(
    winDbPath.endsWith("ve-storage.db"),
    `Database path on Windows must end with ve-storage.db (got ${winDbPath})`
  );
  console.log("PASS Windows file paths and user profile storage directory resolution");
} finally {
  // Restore environment variables
  process.env = originalEnv;
}
