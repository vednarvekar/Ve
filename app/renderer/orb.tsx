import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { didPointerMoveBeyondThreshold } from "../main/orbPolicy.js";
import "./orb.css";

interface OrbPosition {
  x: number;
  y: number;
}

interface CenterDrag {
  pointerId: number;
  startScreenX: number;
  startScreenY: number;
  startX: number | null;
  startY: number | null;
  deltaX: number;
  deltaY: number;
  latestPosition: OrbPosition | null;
  moved: boolean;
  released: boolean;
}

function OrbApp() {
  const [menuVisible, setMenuVisible] = useState(false);
  const dragState = useRef<CenterDrag | null>(null);
  const pendingPosition = useRef<OrbPosition | null>(null);
  const moveFrame = useRef<number | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => window.ve.onOrbMenuState(setMenuVisible), []);

  function commitCenterDrag(drag: CenterDrag) {
    if (!drag.latestPosition) return;
    dragState.current = null;
    const { x, y } = drag.latestPosition;
    window.ve.dragOrb(x, y);
    window.ve.finishOrbCenterDrag();
  }

  function queueCenterDrag(drag: CenterDrag) {
    if (drag.startX === null || drag.startY === null) return;
    const nextPosition = { x: drag.startX + drag.deltaX, y: drag.startY + drag.deltaY };
    drag.latestPosition = nextPosition;
    pendingPosition.current = nextPosition;
    if (moveFrame.current !== null) return;
    moveFrame.current = window.requestAnimationFrame(() => {
      moveFrame.current = null;
      const pending = pendingPosition.current;
      pendingPosition.current = null;
      if (pending) window.ve.dragOrb(pending.x, pending.y);
    });
  }

  function startCenterDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const drag: CenterDrag = {
      pointerId: event.pointerId,
      startScreenX: event.screenX,
      startScreenY: event.screenY,
      startX: null,
      startY: null,
      deltaX: 0,
      deltaY: 0,
      latestPosition: null,
      moved: false,
      released: false,
    };
    dragState.current = drag;
    suppressClick.current = false;
    void window.ve.getOrbPosition().then((position) => {
      if (dragState.current !== drag) return;
      drag.startX = position.x;
      drag.startY = position.y;
      if (!drag.moved) return;
      if (drag.released) {
        drag.latestPosition = { x: drag.startX + drag.deltaX, y: drag.startY + drag.deltaY };
        commitCenterDrag(drag);
        return;
      }
      queueCenterDrag(drag);
    });
  }

  function continueCenterDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.deltaX = event.screenX - drag.startScreenX;
    drag.deltaY = event.screenY - drag.startScreenY;
    if (!drag.moved && !didPointerMoveBeyondThreshold(drag.deltaX, drag.deltaY)) return;
    drag.moved = true;
    suppressClick.current = true;
    queueCenterDrag(drag);
  }

  function finishCenterDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.released = true;
    if (!drag.moved) {
      dragState.current = null;
      return;
    }
    if (moveFrame.current !== null) {
      window.cancelAnimationFrame(moveFrame.current);
      moveFrame.current = null;
    }
    pendingPosition.current = null;
    if (drag.latestPosition) commitCenterDrag(drag);
    setTimeout(() => { suppressClick.current = false; }, 0);
  }

  function handleClick() {
    if (suppressClick.current) return;
    const nextVisible = !menuVisible;
    setMenuVisible(nextVisible);
    void window.ve.setOrbMenuVisible(nextVisible);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const stride = event.shiftKey ? 48 : 16;
    void window.ve.getOrbPosition().then((position) =>
      window.ve.moveOrb(position.x + direction[0] * stride, position.y + direction[1] * stride)
    ).then(() => window.ve.orbSavePosition());
  }

  return (
    <main className="orb-shell" aria-label="Ve floating launcher">
      <div className="orb-disc" aria-hidden="true">
        <span className="orb-logo" />
        <span className="orb-glow" />
      </div>
      <button
        type="button"
        className="orb-action"
        aria-label="Ve assistant launcher. Click the center for actions; drag anywhere on the orb to move. Use arrow keys to reposition."
        aria-expanded={menuVisible}
        title="Ve — click for actions or drag anywhere on the orb to move"
        onPointerDown={startCenterDrag}
        onPointerMove={continueCenterDrag}
        onPointerUp={finishCenterDrag}
        onPointerCancel={finishCenterDrag}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      />
    </main>
  );
}

const root = document.getElementById("orb-root");
if (!root) throw new Error("Launcher root element not found");
createRoot(root).render(<React.StrictMode><OrbApp /></React.StrictMode>);
