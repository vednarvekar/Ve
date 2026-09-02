import { cp, mkdir, readdir, rm, stat } from "fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, extname, join } from "path";

const sourceRoot = "app";
const outputRoot = "dist";

async function copyAssets(sourcePath) {
  const sourceStat = await stat(sourcePath);

  if (sourceStat.isDirectory()) {
    const entries = await readdir(sourcePath);
    await Promise.all(entries.map((entry) => copyAssets(join(sourcePath, entry))));
    return;
  }

  if (extname(sourcePath) === ".ts") {
    return;
  }

  const outputPath = join(outputRoot, sourcePath.slice(sourceRoot.length + 1));

  await mkdir(dirname(outputPath), { recursive: true });
  await cp(sourcePath, outputPath);
}

await rm(outputRoot, { recursive: true, force: true });
execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", "-p", "tsconfig.json"], {
  stdio: "inherit",
});
await copyAssets(sourceRoot);
