import { exec, spawn } from "child_process";
import { platform } from "os";

export interface CommandResult {
    success: boolean;
    message: string;
}

const APP_ALIASES: Record<string, { win: string; linux: string }> = {
  chrome:          { win: "chrome.exe",   linux: "google-chrome" },
  notepad:         { win: "notepad.exe",  linux: "gedit" },
  calculator:      { win: "calc.exe",     linux: "gnome-calculator" },
  calc:            { win: "calc.exe",     linux: "gnome-calculator" },
  explorer:        { win: "explorer.exe", linux: "xdg-open" },
  "file explorer": { win: "explorer.exe", linux: "xdg-open" },
  vscode:          { win: "code",         linux: "code" },
  "vs code":       { win: "code",         linux: "code" },
};

function openApp(appKey: string): Promise<CommandResult> {
  const appName = APP_ALIASES[appKey];

  return new Promise((resolve) => {
    if (!appName) {
      resolve({ success: false, message: `I don't know how to open "${appKey}" yet.` });
      return;
    }

    const isWsl = Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP);
    const isWindows = platform() === "win32" || isWsl;
    const exeName = isWindows ? appName.win : appName.linux;
    const args = !isWindows && (appKey === "explorer" || appKey === "file explorer") ? ["."] : [];
    const child = spawn(exeName, args, { detached: true, stdio: "ignore" });

    child.once("error", (error) => {
      resolve({ success: false, message: `Couldn't open ${appKey}: ${error.message}` });
    });
    child.once("spawn", () => {
      child.unref();
      resolve({ success: true, message: `Opened ${appKey}.` });
    });
  });
}

function openUrl(url: string): Promise<CommandResult> {
    return new Promise((resolve) => {
        const isWindows = platform() === "win32";
        const cmd = isWindows ? `start "" "${url}"` : `xdg-open "${url}"`;

        exec(cmd, (error:any) => {
            if (error) {
                resolve({ success: false, message: `Couldn't open URL: ${error.message}` });
            } else {
                resolve({ success: true, message: `Opened URL: ${url}` });
            }
        });
    })
}

function webSearch(query: string): Promise<CommandResult> {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    return openUrl(searchUrl).then((result) => ({
        success: result.success,
        message: result.success ? `Searched for "${query}".` : result.message,
    }));
}

export async function handleCommand(rawInput: string): Promise<CommandResult> {
    const input = rawInput.trim().toLowerCase();

    if(input.length === 0) {
        return { success: false, message: "Say or type something first." }
    }

    if(input.startsWith("open ")) {
        const target = input.slice("open ".length).trim();

        if(target.startsWith("https://") || target.startsWith("http://")) {
            return openUrl(target);
        }

        if(APP_ALIASES[target]){
            return openApp(target);
        }

        return openApp(target);
    }

    return {
        success: false,
        message: `I don't understand "${rawInput}" yet. Try "open chrome" or "search cats".`,
    };
}
