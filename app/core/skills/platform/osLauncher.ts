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

/**
 * Opens a URL in the user's active default browser window.
 * Uses OS Shell integration so it creates a tab in the current active window
 * rather than launching a redundant new window.
 */
export async function openUrlInSystemBrowser(url: string): Promise<{ success: boolean; message: string }> {
  // 1. Electron Shell API (best desktop integration, attaches to existing window)
  try {
    const electron = await import("electron").catch(() => null);
    if (electron?.shell?.openExternal) {
      await electron.shell.openExternal(url);
      return { success: true, message: `Opened ${url}.` };
    }
  } catch {}

  // 2. WSL Environment: Use Windows cmd.exe /c start to attach to the active Windows browser
  if (IS_WSL) {
    const cmdExe = "/mnt/c/Windows/System32/cmd.exe";
    if (existsSync(cmdExe)) {
      return launchDetached(cmdExe, ["/c", "start", "", url], "Browser");
    }
  }

  // 3. Native platform fallbacks
  const currentOs = platform();
  const launcher = currentOs === "win32" ? "cmd.exe" : currentOs === "darwin" ? "open" : "xdg-open";
  const args = currentOs === "win32" ? ["/c", "start", "", url] : [url];
  return launchDetached(launcher, args, "Browser");
}
