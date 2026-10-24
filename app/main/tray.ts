import { app, Menu, nativeImage, Tray } from "electron";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { createPopupWindow, showPopup, togglePopupFromShortcut } from "./popupWindow.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createTray(shortcutRegistered: boolean): Tray {
  const iconPath = path.join(__dirname, "../assets/tray-icon.png");
  const icon = nativeImage.createFromPath(iconPath);
  const tray = new Tray(icon);
  tray.setToolTip("Ve");

  tray.on("click", () => togglePopupFromShortcut(tray));

  const shortcutLabel = process.platform === "darwin" ? "⌘+Shift+Space" : "Ctrl+Shift+Space";
  const contextMenu = Menu.buildFromTemplate([
    { label: "Ve", enabled: false },
    { type: "separator" },
    {
      label: shortcutRegistered ? `Open Ve (${shortcutLabel})` : "Open Ve",
      click: () => showPopup(tray),
    },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);
  tray.on("right-click", () => tray.popUpContextMenu(contextMenu));

  createPopupWindow(tray);
  return tray;
}
