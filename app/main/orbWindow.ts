import { app, BrowserWindow, screen, type Tray } from "electron";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { clampOrbPosition, isWslEnvironment, launcherMenuBounds, shouldDismissOrbMenuAfterBlur, shouldPersistOrbPosition, visibleWorkArea as applyVisibleWorkArea, type OrbPosition } from "./orbPolicy.js";
import { isTrustedRendererUrl } from "./ipcSecurity.js";

const ORB_SIZE = 68;
const MENU_WIDTH = 204;
const MENU_HEIGHT = 74;
const EDGE_MARGIN = 8;

let orb: BrowserWindow | null = null;
let menu: BrowserWindow | null = null;
let trayAnchor: Tray | null = null;
let orbReady = false;
let orbRequestedVisible = false;
let menuReady = false;
let menuRequested = false;
let savedPosition: OrbPosition | null = null;
let displayListenersRegistered = false;
let positionSaveTimer: ReturnType<typeof setTimeout> | null = null;
let centerDragActive = false;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const orbUrl = pathToFileURL(path.join(__dirname, "../renderer/orb.html")).href;
const menuUrl = pathToFileURL(path.join(__dirname, "../renderer/menu.html")).href;

function detectWslHost(): boolean {
  let kernelVersion = "";
  try {
    kernelVersion = fs.readFileSync("/proc/version", "utf8");
  } catch {
    // On Windows and macOS, WSL-specific insets are not needed.
  }
  return isWslEnvironment(process.env, kernelVersion);
}

const isWslHost = detectWslHost();

function positionFilePath(): string {
  return path.join(app.getPath("userData"), "orb-position.json");
}

function readSavedPosition(): OrbPosition | null {
  try {
    const value: unknown = JSON.parse(fs.readFileSync(positionFilePath(), "utf8"));
    if (value && typeof value === "object" && "x" in value && "y" in value) {
      const position = value as { x: unknown; y: unknown };
      if (typeof position.x === "number" && Number.isFinite(position.x) && typeof position.y === "number" && Number.isFinite(position.y)) {
        return { x: position.x, y: position.y };
      }
    }
  } catch {
    // A missing or malformed preference uses the default corner position.
  }
  return null;
}

function writeSavedPosition(position: OrbPosition): void {
  try {
    const destinationPath = positionFilePath();
    const temporaryPath = `${destinationPath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(position), { mode: 0o600 });
    fs.renameSync(temporaryPath, destinationPath);
    savedPosition = position;
  } catch (error) {
    console.error("Ve could not save the launcher position:", error);
  }
}

function visibleWorkArea(display: Electron.Display) {
  return applyVisibleWorkArea(display.workArea, display.bounds, isWslHost);
}

function nearestAreaFor(position: OrbPosition) {
  const display = screen.getDisplayNearestPoint({ x: position.x + ORB_SIZE / 2, y: position.y + ORB_SIZE / 2 });
  return visibleWorkArea(display);
}

function clampToVisibleArea(position: OrbPosition): OrbPosition {
  return clampOrbPosition(position, nearestAreaFor(position), ORB_SIZE, EDGE_MARGIN);
}

function defaultPosition(): OrbPosition {
  const area = visibleWorkArea(screen.getPrimaryDisplay());
  return clampOrbPosition(
    { x: area.x + area.width - ORB_SIZE - EDGE_MARGIN, y: area.y + area.height - ORB_SIZE - EDGE_MARGIN },
    area,
    ORB_SIZE,
    EDGE_MARGIN
  );
}

function currentPosition(): OrbPosition {
  if (orb && !orb.isDestroyed()) {
    const bounds = orb.getBounds();
    return { x: bounds.x, y: bounds.y };
  }
  return savedPosition ?? defaultPosition();
}

function menuBounds(position: OrbPosition): { x: number; y: number; width: number; height: number } {
  const display = screen.getDisplayNearestPoint({ x: position.x + ORB_SIZE / 2, y: position.y + ORB_SIZE / 2 });
  const area = visibleWorkArea(display);
  return launcherMenuBounds(position, area, ORB_SIZE, MENU_WIDTH, MENU_HEIGHT, EDGE_MARGIN);
}

function configureTrustedPage(window: BrowserWindow): void {
  window.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedRendererUrl([orbUrl, menuUrl], url)) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
}

export function createOrbWindow(tray: Tray): BrowserWindow {
  registerDisplayListeners();
  trayAnchor = tray;
  if (orb && !orb.isDestroyed()) return orb;

  savedPosition ??= readSavedPosition();
  const position = clampToVisibleArea(savedPosition ?? defaultPosition());
  const window = new BrowserWindow({
    x: position.x,
    y: position.y,
    width: ORB_SIZE,
    height: ORB_SIZE,
    title: "Ve launcher",
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: false,
    movable: true,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  orb = window;
  orbReady = false;
  configureTrustedPage(window);
  window.on("move", () => {
    if (orb !== window || window.isDestroyed()) return;
    const position = currentPosition();
    if (menu && !menu.isDestroyed() && menu.isVisible()) {
      const bounds = menuBounds(position);
      menu.setPosition(bounds.x, bounds.y, false);
    }
    if (!shouldPersistOrbPosition(centerDragActive)) return;
    if (positionSaveTimer) clearTimeout(positionSaveTimer);
    positionSaveTimer = setTimeout(() => {
      positionSaveTimer = null;
      if (orb !== window || window.isDestroyed()) return;
      const clamped = clampToVisibleArea(currentPosition());
      if (clamped.x !== window.getBounds().x || clamped.y !== window.getBounds().y) {
        window.setPosition(clamped.x, clamped.y, false);
      }
      writeSavedPosition(clamped);
    }, 180);
  });
  window.once("ready-to-show", () => {
    if (orb !== window || window.isDestroyed()) return;
    orbReady = true;
    if (orbRequestedVisible) window.showInactive();
  });
  window.once("closed", () => {
    if (positionSaveTimer) {
      clearTimeout(positionSaveTimer);
      positionSaveTimer = null;
    }
    if (orb === window) {
      orb = null;
      orbReady = false;
      orbRequestedVisible = false;
    }
  });
  window.webContents.on("did-fail-load", (_event, code, description) => {
    console.error(`Ve launcher failed to load (${code}): ${description}`);
  });
  void window.loadFile(path.join(__dirname, "../renderer/orb.html")).catch((error: unknown) => {
    console.error("Ve launcher failed to load:", error);
  });

  return window;
}

function createMenuWindow(): BrowserWindow {
  const window = new BrowserWindow({
    ...menuBounds(currentPosition()),
    title: "Ve launcher actions",
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: false,
    movable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  menuReady = false;
  configureTrustedPage(window);
  window.once("ready-to-show", () => {
    if (menu !== window || window.isDestroyed()) return;
    menuReady = true;
    if (menuRequested) presentMenu(window);
  });
  window.on("blur", () => {
    setTimeout(() => {
      if (menu !== window || window.isDestroyed()) return;
      const orbFocused = Boolean(orb && !orb.isDestroyed() && orb.isFocused());
      if (shouldDismissOrbMenuAfterBlur(window.isFocused(), orbFocused)) setOrbMenuVisible(false);
    }, 0);
  });
  window.once("closed", () => {
    if (menu === window) menu = null;
    menuReady = false;
  });
  window.webContents.on("did-fail-load", (_event, code, description) => {
    console.error(`Ve launcher menu failed to load (${code}): ${description}`);
  });
  void window.loadFile(path.join(__dirname, "../renderer/menu.html")).catch((error: unknown) => {
    console.error("Ve launcher menu failed to load:", error);
  });
  return window;
}

function presentMenu(window: BrowserWindow): void {
  window.setBounds(menuBounds(currentPosition()));
  window.setAlwaysOnTop(true);
  window.show();
  window.focus();
}

export function showOrb(tray?: Tray): void {
  if (tray) trayAnchor = tray;
  if (!trayAnchor) return;
  orbRequestedVisible = true;
  const window = orb && !orb.isDestroyed() ? orb : createOrbWindow(trayAnchor);
  if (orbReady && !window.isVisible()) window.showInactive();
}

export function hideOrb(): void {
  orbRequestedVisible = false;
  setOrbMenuVisible(false);
  if (orb && !orb.isDestroyed()) orb.hide();
}

export function isOrbVisible(): boolean {
  return Boolean(orb && !orb.isDestroyed() && orb.isVisible());
}

export function setOrbMenuVisible(visible: boolean): void {
  menuRequested = visible;
  if (orb && !orb.isDestroyed() && !orb.webContents.isDestroyed()) {
    orb.webContents.send("ve:orb-menu-state", visible);
  }
  if (!visible) {
    if (menu && !menu.isDestroyed() && menu.isVisible()) menu.hide();
    return;
  }
  if (!trayAnchor) return;
  if (!orb || orb.isDestroyed()) showOrb(trayAnchor);
  const window = menu && !menu.isDestroyed() ? menu : (menu = createMenuWindow());
  if (menuReady) presentMenu(window);
}

export function getOrbPosition(): OrbPosition {
  return currentPosition();
}

export function moveOrb(position: OrbPosition): OrbPosition {
  const clamped = clampToVisibleArea(position);
  if (!orb || orb.isDestroyed()) return clamped;
  orb.setPosition(clamped.x, clamped.y, false);
  return clamped;
}

export function moveOrbDuringCenterDrag(position: OrbPosition): OrbPosition {
  centerDragActive = true;
  return moveOrb(position);
}

export function finishOrbCenterDrag(): void {
  centerDragActive = false;
  saveOrbPosition();
}

export function saveOrbPosition(): void {
  const position = clampToVisibleArea(currentPosition());
  moveOrb(position);
  writeSavedPosition(position);
}

function recoverOrbToDisplay(): void {
  if (!orb || orb.isDestroyed()) return;
  moveOrb(currentPosition());
  if (menu && !menu.isDestroyed() && menu.isVisible()) menu.setBounds(menuBounds(currentPosition()));
}

function registerDisplayListeners(): void {
  if (displayListenersRegistered) return;
  displayListenersRegistered = true;
  screen.on("display-added", recoverOrbToDisplay);
  screen.on("display-removed", recoverOrbToDisplay);
  screen.on("display-metrics-changed", recoverOrbToDisplay);
}
