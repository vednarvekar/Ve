import { cp, mkdir, readdir, rm, stat } from "fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, extname, join } from "path";

const sourceRoot = "app";
const outputRoot = "dist";

async function copyAssets(sourcePath, destinationPath) {
  const sourceStat = await stat(sourcePath);

  if (sourceStat.isDirectory()) {
    const entries = await readdir(sourcePath);
    await Promise.all(entries.map((entry) =>
      copyAssets(join(sourcePath, entry), join(destinationPath, entry))
    ));
    return;
  }

  await mkdir(dirname(destinationPath), { recursive: true });
  await cp(sourcePath, destinationPath);
}

await rm(outputRoot, { recursive: true, force: true });
execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", "tsconfig.json"], {
  stdio: "inherit",
});
execFileSync(process.execPath, [
  "node_modules/vite/bin/vite.js",
  "build",
  "--config",
  "app/renderer/vite.config.ts",
], { stdio: "inherit" });
await copyAssets(join(sourceRoot, "assets"), join(outputRoot, "assets"));
