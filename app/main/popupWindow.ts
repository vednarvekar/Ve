import { BrowserWindow, screen, Tray } from 'electron';
import * as path from "path";

const WINDOW_WIDTH = 400;
const WINDOW_HEIGHT = 600;

let popup: BrowserWindow | null = null;


// Positions the popup near the system tray.
function computePosition(tray: Tray): { x: number; y: number } {
  const trayBounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });
  const workArea = display.workArea;

  // Anchor bottom-right of the work area, just above the taskbar,
  const x = Math.min(
    Math.max(trayBounds.x - WINDOW_WIDTH / 2, workArea.x),
    workArea.x + workArea.width - WINDOW_WIDTH
  );
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
        show: false,
        frame: false,
        resizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        transparent: true,
        webPreferences:{
            preload: path.join(__dirname, "../preload/preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    popup.loadFile(path.join(__dirname, "../renderer/index.html"));

    // Close (hide, don't destroy) when it loses focus — flyout behavior,
    // not a persistent window the user has to manually close.
    popup.on("blur", () => {
        popup?.hide();
    });

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
