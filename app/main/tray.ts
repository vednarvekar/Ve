import {Tray, app, Menu, nativeImage} from 'electron';
import { togglePopup, createPopupWindow } from './popupWindow.js';
import * as path from "path";
import { fileURLToPath } from "url";

let tray: Tray | null = null;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createTray() {
    const iconPath = path.join(__dirname, "../assets/tray-icon.png");
    const icon = nativeImage.createFromPath(iconPath);

    tray = new Tray(icon);
    tray.setToolTip("Ve");

    // Left-Click opens chat popup
    tray.on('click', () => {
        if(tray) togglePopup(tray);
    });

    // Right-Click opens context menu
    const contextMenu = Menu.buildFromTemplate([
      { label: "Ve", enabled: false },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]);
    tray.on('right-click', () => {
        tray?.popUpContextMenu(contextMenu);
    });

    createPopupWindow(tray);

    return tray;
}
