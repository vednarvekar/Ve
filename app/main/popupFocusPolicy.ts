export interface ScreenPoint {
  x: number;
  y: number;
}

export interface ScreenRect extends ScreenPoint {
  width: number;
  height: number;
}

/**
 * A blur caused by launching an app from inside Ve should leave Ve available
 * in the taskbar. A pointer click outside the popup dismisses it to the tray.
 */
export function shouldDismissPopupAfterBlur(
  bounds: ScreenRect,
  cursor: ScreenPoint,
  windowIsFocused: boolean
): boolean {
  if (windowIsFocused) return false;
  const pointerInside =
    cursor.x >= bounds.x &&
    cursor.x < bounds.x + bounds.width &&
    cursor.y >= bounds.y &&
    cursor.y < bounds.y + bounds.height;
  return !pointerInside;
}
