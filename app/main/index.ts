import { app, globalShortcut, ipcMain } from "electron";
import { createTray } from "./tray.js";
import { togglePopup } from "./popupWindow.js";
import { handleCommand } from "../core/intentParser/commandFallback.js";
import { listMemories, addMemory, deleteMemory, listContacts, addContact, deleteContact, recordBehavior, getPredictionState, clearBehavior } from "./assistantService.js";

// Keep the app running with no windows/dock presence — this is tray-only,
// there is no "main window" and the app must never quit when a popup closes.
app.dock?.hide();

app.whenReady().then(() => {
  const tray = createTray();
  const shortcutRegistered = globalShortcut.register("CommandOrControl+Shift+Space", () => {
    togglePopup(tray);
  });
  if (!shortcutRegistered) console.warn("Ve could not register CommandOrControl+Shift+Space.");
  togglePopup(tray);
}).catch((error) => {
  console.error("Ve failed during startup:", error);
  app.quit();
});

app.on("window-all-closed", () => {
  // Popup windows hide rather than close, and we have no other windows.
  // Intentionally do nothing here — never quit on window close for a
  // tray-only app (default Electron behavior would quit on all-closed).
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

// IPC bridge: renderer sends a raw command string, main process runs it
// through the (currently hardcoded) command handler and returns the result.
ipcMain.handle("ve:run-command", async (_event, input: string) => {
  try {
    const result = await handleCommand(input);
    if (result.success && result.behaviorAction) {
      try {
        await recordBehavior(result.behaviorAction);
      } catch (error) {
        console.warn("Ve could not record a local behavior sample:", error);
      }
    }
    return result;
  } catch (err: any) {
    return { success: false, message: err.message || "Execution error occurred." };
  }
});

ipcMain.handle("ve:list-memories", () => listMemories());
ipcMain.handle("ve:add-memory", (_event, text: string) => addMemory(text));
ipcMain.handle("ve:delete-memory", (_event, id: string) => deleteMemory(id));
ipcMain.handle("ve:list-contacts", () => listContacts());
ipcMain.handle("ve:add-contact", (_event, name: string, phone: string) => addContact(name, phone));
ipcMain.handle("ve:delete-contact", (_event, id: string) => deleteContact(id));
ipcMain.handle("ve:get-prediction-state", () => getPredictionState());
ipcMain.handle("ve:clear-behavior", () => clearBehavior());
