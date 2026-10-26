export interface OrbPosition {
  x: number;
  y: number;
}

export interface WorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function isWslEnvironment(environment: Record<string, string | undefined>, kernelVersion: string): boolean {
  return Boolean(environment.WSL_DISTRO_NAME || environment.WSL_INTEROP || /microsoft/i.test(kernelVersion));
}

export function visibleWorkArea(workArea: WorkArea, displayBounds: WorkArea, reserveWslTaskbar: boolean, inset = 48): WorkArea {
  const workAreaBottom = workArea.y + workArea.height;
  const displayBottom = displayBounds.y + displayBounds.height;
  const reserve = reserveWslTaskbar && workAreaBottom >= displayBottom ? inset : 0;
  return { ...workArea, height: Math.max(1, workArea.height - reserve) };
}

export function clampOrbPosition(position: OrbPosition, workArea: WorkArea, size: number, margin = 8): OrbPosition {
  const maxX = workArea.x + workArea.width - size - margin;
  const maxY = workArea.y + workArea.height - size - margin;
  return {
    x: Math.round(Math.min(Math.max(position.x, workArea.x + margin), Math.max(workArea.x + margin, maxX))),
    y: Math.round(Math.min(Math.max(position.y, workArea.y + margin), Math.max(workArea.y + margin, maxY))),
  };
}

export function launcherMenuBounds(
  position: OrbPosition,
  workArea: WorkArea,
  orbSize = 68,
  menuWidth = 204,
  menuHeight = 74,
  margin = 8
): WorkArea {
  const rightX = position.x + orbSize;
  const leftX = position.x - menuWidth;
  const x = rightX + menuWidth <= workArea.x + workArea.width - margin
    ? rightX
    : Math.max(workArea.x + margin, leftX);
  const y = Math.min(Math.max(position.y + Math.floor((orbSize - menuHeight) / 2), workArea.y + margin),
    workArea.y + workArea.height - menuHeight - margin);
  return { x, y, width: menuWidth, height: menuHeight };
}

export function didPointerMoveBeyondThreshold(dx: number, dy: number, threshold = 5): boolean {
  return Math.hypot(dx, dy) >= threshold;
}

export function hideLauncherUsesTaskbarFallback(platform: string): boolean {
  return platform === "linux";
}

export function shouldDismissOrbMenuAfterBlur(menuFocused: boolean, orbFocused: boolean): boolean {
  return !menuFocused && !orbFocused;
}

export function shouldPersistOrbPosition(centerDragActive: boolean): boolean {
  return !centerDragActive;
}
