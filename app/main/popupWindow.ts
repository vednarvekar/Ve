import { BrowserWindow, screen, Tray } from "electron";
import * as path from "path";
import { fileURLToPath } from "url";

const WINDOW_WIDTH = 550;
const WINDOW_HEIGHT = 600;

let popup: BrowserWindow | null = null;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function windowBounds(tray: Tray): { x: number; y: number; width: number; height: number } {
  const trayBounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x || 0,
    y: trayBounds.y || 0,
  });
  const workArea = display.workArea;
  const margin = 16;

  const width = Math.min(WINDOW_WIDTH, Math.max(320, workArea.width - margin * 2));
  const height = Math.min(WINDOW_HEIGHT, Math.max(320, workArea.height - margin * 2));
  const x = workArea.x + workArea.width - width - margin;
  // Normally workArea excludes the taskbar. Some WSL desktops report the
  // full display instead, so reserve a small bottom inset in that case.
  const displayBottom = display.bounds.y + display.bounds.height;
  const workAreaBottom = workArea.y + workArea.height;
  const wslTaskbarInset = process.env.WSL_DISTRO_NAME && workAreaBottom >= displayBottom ? 48 : 0;
  const y = workAreaBottom - wslTaskbarInset - height - margin;

  return { x: Math.round(x), y: Math.round(y), width, height };
}

export function createPopupWindow(tray: Tray): BrowserWindow {
  const { x, y, width, height } = windowBounds(tray);

  popup = new BrowserWindow({
    height,
    width,
    x,
    y,
    icon: path.join(__dirname, "../assets/tray-icon.png"),
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: "#1f1f1f",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  void popup.loadFile(path.join(__dirname, "../renderer/index.html"));

  return popup;
}

export function togglePopup(tray: Tray): void {
  if (!popup) return;

  if (popup.isVisible()) {
    popup.hide();
    return;
  }

  const { x, y, width, height } = windowBounds(tray);
  popup.setBounds({ x, y, width, height });
  popup.show();
  popup.focus();
}
