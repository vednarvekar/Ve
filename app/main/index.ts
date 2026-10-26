import { app, globalShortcut, ipcMain, type IpcMainInvokeEvent, type Tray } from "electron";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createTray } from "./tray.js";
import { hidePopup, showPopup, togglePopupFromShortcut } from "./popupWindow.js";
import { hideOrb, getOrbPosition, isOrbVisible, moveOrb, moveOrbDuringCenterDrag, finishOrbCenterDrag, saveOrbPosition, setOrbMenuVisible, showOrb } from "./orbWindow.js";
import { guardTrustedRendererIpc, guardTrustedRendererMessage, isBoundedString } from "./ipcSecurity.js";
import { hideLauncherUsesTaskbarFallback } from "./orbPolicy.js";
import { executeUserInput } from "../core/intentParser/index.js";
import {
  listMemories,
  addMemory,
  deleteMemory,
  listContacts,
  addContact,
  deleteContact,
  getPredictionState,
  clearBehavior,
} from "./assistantService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const trustedRendererUrl = pathToFileURL(path.join(__dirname, "../renderer/index.html")).href;
const trustedOrbUrl = pathToFileURL(path.join(__dirname, "../renderer/orb.html")).href;
const trustedMenuUrl = pathToFileURL(path.join(__dirname, "../renderer/menu.html")).href;
const trustedLauncherUrls = [trustedOrbUrl, trustedMenuUrl];

function registerRendererIpc<TArgs extends unknown[], TResult>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: TArgs) => TResult,
  trustedUrls: string | readonly string[] = trustedRendererUrl
): void {
  ipcMain.handle(channel, guardTrustedRendererIpc(trustedUrls, handler));
}

// Only one tray process may own the shortcut and popup lifecycle.
const ownsSingleInstanceLock = app.requestSingleInstanceLock();
let tray: Tray | null = null;

function openFromSystem(): void {
  if (tray) {
    showOrb(tray);
    showPopup(tray);
  }
}

if (!ownsSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    openFromSystem();
  });

  app.on("activate", () => {
    openFromSystem();
  });

  void app.whenReady().then(() => {
    // Keep Ve in the tray on macOS as on the other supported development hosts.
    app.dock?.hide();

    const shortcutRegistered = globalShortcut.register("CommandOrControl+Shift+Space", () => {
      if (!tray) return;
      if (!isOrbVisible()) showOrb(tray);
      else togglePopupFromShortcut(tray);
    });
    if (!shortcutRegistered) console.warn("Ve could not register CommandOrControl+Shift+Space.");

    tray = createTray(shortcutRegistered);
    showOrb(tray);
  }).catch((error) => {
    console.error("Ve failed during startup:", error);
    app.quit();
  });

  app.on("window-all-closed", () => {
    // Closing the popup leaves Ve available from the tray.
  });

  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
  });
}

// IPC bridge: command text is handled locally and is not persisted here.
registerRendererIpc("ve:run-command", async (_event, input: unknown) => {
  if (!isBoundedString(input, 4000, true)) {
    return { success: false, message: "Commands must be text under 4,000 characters." };
  }
  try {
    return await executeUserInput(input);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Execution error occurred.";
    return { success: false, message };
  }
});

registerRendererIpc("ve:list-memories", () => listMemories());
registerRendererIpc("ve:add-memory", (_event, text: unknown) => {
  if (!isBoundedString(text, 2000)) throw new Error("Memory text must be under 2,000 characters.");
  return addMemory(text);
});
registerRendererIpc("ve:delete-memory", (_event, id: unknown) => {
  if (!isBoundedString(id, 128)) throw new Error("Invalid memory identifier.");
  return deleteMemory(id);
});
registerRendererIpc("ve:list-contacts", () => listContacts());
registerRendererIpc("ve:add-contact", (_event, name: unknown, phone: unknown) => {
  if (!isBoundedString(name, 80) || !isBoundedString(phone, 32)) {
    throw new Error("Contact name or phone number is invalid.");
  }
  return addContact(name, phone);
});
registerRendererIpc("ve:delete-contact", (_event, id: unknown) => {
  if (!isBoundedString(id, 128)) throw new Error("Invalid contact identifier.");
  return deleteContact(id);
});
registerRendererIpc("ve:get-prediction-state", () => getPredictionState());
registerRendererIpc("ve:clear-behavior", () => clearBehavior());

registerRendererIpc("ve:orb-menu-visible", (_event, visible: unknown) => {
  if (typeof visible !== "boolean") throw new Error("Invalid launcher menu state.");
  setOrbMenuVisible(visible);
}, trustedLauncherUrls);
registerRendererIpc("ve:orb-open-chat", () => {
  setOrbMenuVisible(false);
  if (tray) showPopup(tray);
}, trustedLauncherUrls);
registerRendererIpc("ve:orb-hide", () => {
  setOrbMenuVisible(false);
  hideOrb();
  // Linux tray hosts are inconsistent; keep Ve reachable through its normal
  // taskbar window when the launcher is hidden there.
  if (tray && hideLauncherUsesTaskbarFallback(process.platform)) showPopup(tray);
}, trustedLauncherUrls);
registerRendererIpc("ve:show-orb", () => {
  if (!tray) return;
  showOrb(tray);
  hidePopup();
});
registerRendererIpc("ve:orb-get-position", () => getOrbPosition(), trustedLauncherUrls);
registerRendererIpc("ve:orb-move", (_event, x: unknown, y: unknown) => {
  if (typeof x !== "number" || !Number.isFinite(x) || typeof y !== "number" || !Number.isFinite(y)) {
    throw new Error("Invalid launcher position.");
  }
  return moveOrb({ x: Math.round(x), y: Math.round(y) });
}, trustedLauncherUrls);
ipcMain.on("ve:orb-drag-position", guardTrustedRendererMessage(trustedOrbUrl, (_event, x: unknown, y: unknown) => {
  if (typeof x !== "number" || !Number.isFinite(x) || Math.abs(x) > 1_000_000 ||
      typeof y !== "number" || !Number.isFinite(y) || Math.abs(y) > 1_000_000) return;
  moveOrbDuringCenterDrag({ x: Math.round(x), y: Math.round(y) });
}));
ipcMain.on("ve:orb-drag-finish", guardTrustedRendererMessage(trustedOrbUrl, () => finishOrbCenterDrag()));
registerRendererIpc("ve:orb-save-position", () => saveOrbPosition(), trustedLauncherUrls);
