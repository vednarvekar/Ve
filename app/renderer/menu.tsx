import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./menu.css";

function LauncherMenu() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const positionRef = useRef(position);
  positionRef.current = position;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") void window.ve.setOrbMenuVisible(false);
      if (!event.ctrlKey) return;
      const directions: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
      };
      const direction = directions[event.key];
      if (!direction) return;
      event.preventDefault();
      const stride = event.shiftKey ? 48 : 16;
      const next = { x: positionRef.current.x + direction[0] * stride, y: positionRef.current.y + direction[1] * stride };
      setPosition(next);
      void window.ve.moveOrb(next.x, next.y).then((actualPosition) => {
        setPosition(actualPosition);
        return window.ve.orbSavePosition();
      });
    }
    void window.ve.getOrbPosition().then(setPosition);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <nav className="launcher-menu" aria-label="Ve launcher actions">
      <button className="menu-action" aria-label="Open Ve chat" title="Open chat" onClick={() => void window.ve.orbOpenChat()}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-5 4v-4.3a2.5 2.5 0 0 1-1-2z" /></svg>
        <span>Chat</span>
      </button>
      <button className="menu-action" aria-label="Voice input is not available yet" title="Voice input is not available yet" disabled>
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8" /></svg>
        <span>Voice</span>
      </button>
      <button className="menu-action" aria-label="Hide floating launcher" title="Hide launcher; Ve stays available from the tray or taskbar" onClick={() => void window.ve.orbHide()}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v5a3 3 0 0 1-3 3h-2v7H9v-7H7a3 3 0 0 1-3-3zM4 10h4m8 0h4" /></svg>
        <span>Hide</span>
      </button>
    </nav>
  );
}

const root = document.getElementById("menu-root");
if (!root) throw new Error("Launcher menu root element not found");
createRoot(root).render(<React.StrictMode><LauncherMenu /></React.StrictMode>);
