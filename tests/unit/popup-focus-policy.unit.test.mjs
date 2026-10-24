import assert from "node:assert/strict";
import { shouldDismissPopupAfterBlur } from "../../dist/main/popupFocusPolicy.js";

const bounds = { x: 100, y: 200, width: 550, height: 600 };

assert.equal(
  shouldDismissPopupAfterBlur(bounds, { x: 200, y: 300 }, false),
  false,
  "launching a task from inside Ve must not dismiss the task window"
);
assert.equal(
  shouldDismissPopupAfterBlur(bounds, { x: 800, y: 300 }, false),
  true,
  "a click outside Ve should dismiss the popup"
);
assert.equal(
  shouldDismissPopupAfterBlur(bounds, { x: 800, y: 900 }, true),
  false,
  "a stale blur event must not hide a window that has regained focus"
);
assert.equal(
  shouldDismissPopupAfterBlur(bounds, { x: 650, y: 300 }, false),
  true,
  "the popup right edge is exclusive for outside-click detection"
);
