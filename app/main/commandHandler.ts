import { exec } from "child_process";
import { platform } from "os";

export interface CommandResult {
    success: boolean;
    message: string;
}

const APP_ALIASES: Record<string, string> = {
    chrome: "chrome",
    notepad: "notepad",
    calculator: "calc",
    explorer: "explorer",
    "file explorer": "explorer",
    vscode: "code",
    "vs code": "code",
}

function openApp(appKey: string): Promise<CommandResult> {
  const exeName = APP_ALIASES[appKey];
  return new Promise((resolve) => {
    if (!exeName) {
      resolve({ success: false, message: `I don't know how to open "${appKey}" yet.` });
      return;
    }

    const isWindows = platform() === "win32";
    const cmd = isWindows ? `start "" ${exeName}` : exeName; // dev fallback for non-Windows testing

    exec(cmd, (error) => {
      if (error) {
        resolve({ success: false, message: `Couldn't open ${appKey}: ${error.message}` });
      } else {
        resolve({ success: true, message: `Opened ${appKey}.` });
      }
    });
  });
}

function openUrl(url: string): Promise<CommandResult> {
    return new Promise((resolve) => {
        const isWindows = platform() === "win32";
        const cmd = isWindows ? `start "" "${url}"` : `xdg-open "${url}"`;

        exec(cmd, (error) => {
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

export async function handleCommand(command: string): Promise<CommandResult> {
    const input = rawInput
}