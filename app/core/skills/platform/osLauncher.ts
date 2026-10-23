import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";

export const IS_WSL = platform() === "linux" && Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP);

export function findWslChrome(): string | null {
  const candidates = [
    "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe",
    "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/mnt/c/Users/" + (process.env.USER || "") + "/AppData/Local/Google/Chrome/Application/chrome.exe",
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export function launchDetached(
  executable: string,
  args: string[],
  label: string
): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    try {
      const child = spawn(executable, args, { detached: true, stdio: "ignore" });
      child.once("error", (err) => {
        resolve({
          success: false,
          message: `Could not launch ${label}: ${err.message}. Check that it is installed and accessible.`,
        });
      });
      child.once("spawn", () => {
        child.unref();
        resolve({ success: true, message: `Opened ${label}.` });
      });
    } catch (err: any) {
      resolve({
        success: false,
        message: `Failed to spawn ${label}: ${err?.message || "Unknown error"}`,
      });
    }
  });
}
