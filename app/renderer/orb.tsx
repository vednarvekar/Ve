import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { didPointerMoveBeyondThreshold } from "../main/orbPolicy.js";
import "./orb.css";

interface DragState {
  pointerId: number;
  startScreenX: number;
  startScreenY: number;
  startX: number;
  startY: number;
  moved: boolean;
}

function OrbApp() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [menuVisible, setMenuVisible] = useState(false);
  const dragState = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const pendingPosition = useRef<{ x: number; y: number } | null>(null);
  const moveFrame = useRef<number | null>(null);

  useEffect(() => {
    void window.ve.getOrbPosition().then(setPosition);
    return window.ve.onOrbMenuState(setMenuVisible);
  }, []);

  function startDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      pointerId: event.pointerId,
      startScreenX: event.screenX,
      startScreenY: event.screenY,
      startX: position.x,
      startY: position.y,
      moved: false,
    };
    suppressClick.current = false;
  }

  function continueDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.screenX - drag.startScreenX;
    const dy = event.screenY - drag.startScreenY;
    if (!drag.moved && !didPointerMoveBeyondThreshold(dx, dy)) return;
    drag.moved = true;
    suppressClick.current = true;
    const nextPosition = { x: drag.startX + dx, y: drag.startY + dy };
    pendingPosition.current = nextPosition;
    if (moveFrame.current === null) {
      moveFrame.current = window.requestAnimationFrame(() => {
        moveFrame.current = null;
        const latestPosition = pendingPosition.current;
        pendingPosition.current = null;
        if (latestPosition) void window.ve.moveOrb(latestPosition.x, latestPosition.y);
      });
    }
  }

  function finishDrag(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragState.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      if (moveFrame.current !== null) {
        window.cancelAnimationFrame(moveFrame.current);
        moveFrame.current = null;
      }
      const finalPosition = pendingPosition.current;
      pendingPosition.current = null;
      const move = finalPosition
        ? window.ve.moveOrb(finalPosition.x, finalPosition.y)
        : window.ve.getOrbPosition();
      void move.then((actualPosition) => {
        setPosition(actualPosition);
        return window.ve.orbSavePosition();
      });
      setTimeout(() => { suppressClick.current = false; }, 0);
    }
    dragState.current = null;
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
    const nextPosition = {
      x: position.x + direction[0] * stride,
      y: position.y + direction[1] * stride,
    };
    setPosition(nextPosition);
    void window.ve.moveOrb(nextPosition.x, nextPosition.y).then((actualPosition) => {
      setPosition(actualPosition);
      return window.ve.orbSavePosition();
    });
  }

  return (
    <main className="orb-shell">
      <button
        type="button"
        className="orb-button"
        aria-label="Ve assistant launcher. Click for actions; drag to move. Use arrow keys to reposition."
        aria-expanded={menuVisible}
        title="Ve — click for actions, drag to move"
        onPointerDown={startDrag}
        onPointerMove={continueDrag}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        <span className="orb-logo" aria-hidden="true" />
        <span className="orb-glow" aria-hidden="true" />
      </button>
    </main>
  );
}

const root = document.getElementById("orb-root");
if (!root) throw new Error("Launcher root element not found");
createRoot(root).render(<React.StrictMode><OrbApp /></React.StrictMode>);
