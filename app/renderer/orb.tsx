import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./orb.css";

function OrbApp() {
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => window.ve.onOrbMenuState(setMenuVisible), []);

  function handleClick() {
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
        aria-label="Ve assistant launcher. Click the center for actions; drag the outer circle to move. Use arrow keys to reposition."
        aria-expanded={menuVisible}
        title="Ve — click the center for actions; drag the outer circle to move"
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      />
    </main>
  );
}

const root = document.getElementById("orb-root");
if (!root) throw new Error("Launcher root element not found");
createRoot(root).render(<React.StrictMode><OrbApp /></React.StrictMode>);
