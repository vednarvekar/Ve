// Copies static files that Vite doesn't touch — just the tray icon PNGs.
// (Renderer HTML/CSS are now bundled by Vite itself; see vite.config.ts.)
import fs from "fs";
import path from "path";

const filesToCopy = [
  ["app/assets/tray-icon.png", "dist/assets/tray-icon.png"],
  ["app/assets/tray-icon@2x.png", "dist/assets/tray-icon@2x.png"],
];

for (const [from, to] of filesToCopy) {
  const src = path.join(__dirname, "..", from);
  const dest = path.join(__dirname, "..", to);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log(`copied ${from} -> ${to}`);
}