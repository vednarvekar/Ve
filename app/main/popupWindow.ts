import { BrowserWindow, screen, type Tray } from "electron";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { shouldDismissPopupAfterBlur } from "./popupFocusPolicy.js";
import { isTrustedRendererUrl } from "./ipcSecurity.js";

const WINDOW_WIDTH = 550;
const WINDOW_HEIGHT = 600;
const WINDOW_MARGIN = 16;

let popup: BrowserWindow | null = null;
let anchorTray: Tray | null = null;
let popupReady = false;
let shouldShowPopup = false;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const trustedRendererUrl = pathToFileURL(path.join(__dirname, "../renderer/index.html")).href;

function windowBounds(tray: Tray): { x: number; y: number; width: number; height: number } {
  const trayBounds = tray.getBounds();
  const display = screen.getDisplayNearestPoint({
    x: trayBounds.x + Math.floor(trayBounds.width / 2),
    y: trayBounds.y + Math.floor(trayBounds.height / 2),
  });
  const workArea = display.workArea;
  const width = Math.max(1, Math.min(WINDOW_WIDTH, workArea.width - WINDOW_MARGIN * 2));
  const height = Math.max(1, Math.min(WINDOW_HEIGHT, workArea.height - WINDOW_MARGIN * 2));
  const x = workArea.x + workArea.width - width - WINDOW_MARGIN;
  // Some WSL desktops report the full display instead of excluding the taskbar.
  const displayBottom = display.bounds.y + display.bounds.height;
  const workAreaBottom = workArea.y + workArea.height;
  const wslTaskbarInset = process.env.WSL_DISTRO_NAME && workAreaBottom >= displayBottom ? 48 : 0;
  const y = workAreaBottom - wslTaskbarInset - height - WINDOW_MARGIN;

  return { x: Math.round(x), y: Math.round(y), width, height };
}

function presentPopup(window: BrowserWindow, tray: Tray): void {
  const { x, y, width, height } = windowBounds(tray);
  window.setBounds({ x, y, width, height });
  window.setAlwaysOnTop(true);
  window.show();
  window.focus();
}

export function createPopupWindow(tray: Tray): BrowserWindow {
  anchorTray = tray;
  if (popup && !popup.isDestroyed()) return popup;

  popupReady = false;
  const window = new BrowserWindow({
    ...windowBounds(tray),
    icon: path.join(__dirname, "../assets/tray-icon.png"),
    title: "Ve",
    show: false,
    frame: false,
    resizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    backgroundColor: "#1f1f1f",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  popup = window;

  window.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedRendererUrl(trustedRendererUrl, url)) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  window.once("ready-to-show", () => {
    if (popup !== window || window.isDestroyed()) return;
    popupReady = true;
    if (shouldShowPopup && anchorTray) presentPopup(window, anchorTray);
  });

  window.on("blur", () => {
    if (popup !== window) return;
    setTimeout(() => {
      if (popup !== window || window.isDestroyed() || window.isFocused()) return;
      const cursor = screen.getCursorScreenPoint();
      if (shouldDismissPopupAfterBlur(window.getBounds(), cursor, window.isFocused())) {
        hidePopup();
      } else {
        // An external app launched from a control inside Ve took focus. Keep Ve
        // available in the taskbar, but let that app appear above this window.
        window.setAlwaysOnTop(false);
      }
    }, 0);
  });

  window.once("closed", () => {
    if (popup !== window) return;
    popup = null;
    popupReady = false;
    shouldShowPopup = false;
  });

  window.webContents.on("did-fail-load", (_event, code, description) => {
    console.error(`Ve popup failed to load (${code}): ${description}`);
  });

  void window.loadFile(path.join(__dirname, "../renderer/index.html")).catch((error: unknown) => {
    console.error("Ve popup failed to load:", error);
  });

  return window;
}

export function showPopup(tray?: Tray): void {
  if (tray) anchorTray = tray;
  if (!anchorTray) return;

  shouldShowPopup = true;
  const window = popup && !popup.isDestroyed() ? popup : createPopupWindow(anchorTray);
  if (popupReady) presentPopup(window, anchorTray);
}

export function hidePopup(): void {
  shouldShowPopup = false;
  if (popup && !popup.isDestroyed() && popup.isVisible()) popup.hide();
}

/** Global summon hotkey: bring a visible background popup forward. */
export function togglePopupFromShortcut(tray?: Tray): void {
  if (popup?.isVisible() && popup.isFocused()) {
    hidePopup();
  } else {
    showPopup(tray);
  }
}
