import { BrowserWindow, screen, Tray } from 'electron';
import * as path from "path";
import { fileURLToPath } from "url";

const WINDOW_WIDTH = 550;
const WINDOW_HEIGHT = 600;

let popup: BrowserWindow | null = null;
const __dirname = path.dirname(fileURLToPath(import.meta.url));


// Keep the popup in the lower-right corner of the active display.
function computePosition(tray: Tray): { x: number; y: number } {
  const trayBounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
  const workArea = display.workArea;

  const x = workArea.x + workArea.width - WINDOW_WIDTH - 8;
  const y = workArea.y + workArea.height - WINDOW_HEIGHT - 8;

  return { x: Math.round(x), y: Math.round(y) };
}

export function createPopupWindow(tray: Tray): BrowserWindow {
    const { x, y } = computePosition(tray);

    popup = new BrowserWindow({
        height: WINDOW_HEIGHT,
        width: WINDOW_WIDTH,
        x,
        y,
        icon: path.join(__dirname, "../assets/tray-icon.png"),
        show: false,
        frame: false,
        type: "panel",
        resizable: false,
        fullscreenable: false,
        skipTaskbar: false,
        alwaysOnTop: true,
        transparent: true,
        webPreferences:{
            preload: path.join(__dirname, "../preload/preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    popup.setSkipTaskbar(true);

    popup.loadFile(path.join(__dirname, "../renderer/index.html"));

    return popup;
}

export function togglePopup(tray: Tray): void {
  if (!popup) return;

  if (popup.isVisible()) {
    popup.hide();
    return;
  }

  const { x, y } = computePosition(tray);
  popup.setPosition(x, y);
  popup.show();
  popup.focus();
}

export function getPopup(): BrowserWindow | null {
  return popup;
}
