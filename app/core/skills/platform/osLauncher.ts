import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";

export const IS_WSL = platform() === "linux" && Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP);

export function findWslCmd(): string | null {
  const candidates = [
    "/mnt/c/WINDOWS/system32/cmd.exe",
    "/mnt/c/Windows/System32/cmd.exe",
    "/mnt/c/windows/system32/cmd.exe",
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return "cmd.exe";
}

export function findWslChrome(): string | null {
  const candidates = [
    "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe",
    "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/mnt/c/Users/" + (process.env.USER || process.env.USERNAME || "") + "/AppData/Local/Google/Chrome/Application/chrome.exe",
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export function launchDetached(
  executable: string,
  args: string[],
  label: string
): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = (res: { success: boolean; message: string }) => {
      if (!resolved) {
        resolved = true;
        resolve(res);
      }
    };

    try {
      const child = spawn(executable, args, {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });

      child.once("error", (err) => {
        safeResolve({
          success: false,
          message: `Could not launch ${label}: ${err.message}. Check that it is installed and accessible.`,
        });
      });

      // Catch immediate crash / non-zero exit
      child.once("exit", (code) => {
        if (code !== null && code !== 0) {
          safeResolve({
            success: false,
            message: `Could not open ${label}: process exited with error code ${code}.`,
          });
        }
      });

      // Allow a brief moment to catch immediate spawn errors
      setTimeout(() => {
        if (!resolved) {
          try {
            child.unref();
          } catch {}
          safeResolve({ success: true, message: `Opened ${label}.` });
        }
      }, 50);
    } catch (err: any) {
      safeResolve({
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
  // 1. WSL Environment: Must use Windows cmd.exe to reach the user's Windows default browser!
  if (IS_WSL) {
    const cmd = findWslCmd() || "cmd.exe";
    const res = await launchDetached(cmd, ["/c", "start", "", url], "Browser");
    if (res.success) return res;
    // If WSL cmd.exe failed, do not falsely claim success - return the failure!
    return res;
  }

  // 2. Electron Shell API (on native Windows / macOS)
  try {
    const electron = await import("electron").catch(() => null);
    if (electron?.shell?.openExternal) {
      await electron.shell.openExternal(url);
      return { success: true, message: `Opened ${url}.` };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `System browser failed to open ${url}: ${err?.message || "Desktop integration error"}`,
    };
  }

  // 3. Native platform fallbacks
  const currentOs = platform();
  const launcher = currentOs === "win32" ? "cmd.exe" : currentOs === "darwin" ? "open" : "xdg-open";
  const args = currentOs === "win32" ? ["/c", "start", "", url] : [url];
  return launchDetached(launcher, args, "Browser");
}
