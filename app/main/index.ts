import { app, ipcMain } from "electron";
import { createTray } from "./tray";
import { handleCommand } from "./commandHandler";

// Keep the app running with no windows/dock presence — this is tray-only,
// there is no "main window" and the app must never quit when a popup closes.
app.dock?.hide();

app.whenReady().then(() => {
  createTray();
});

app.on("window-all-closed", () => {
  // Popup windows hide rather than close, and we have no other windows.
  // Intentionally do nothing here — never quit on window close for a
  // tray-only app (default Electron behavior would quit on all-closed).
});

// IPC bridge: renderer sends a raw command string, main process runs it
// through the (currently hardcoded) command handler and returns the result.
ipcMain.handle("ve:run-command", async (_event, input: string) => {
  return handleCommand(input);
});
