import { platform } from "node:os";
import { existsSync } from "node:fs";
import type { BaseSkill, SkillContext, SkillResult, SkillValidationResult } from "../../contracts/skillTypes.js";
import { findWslCmd, findWslChrome, launchDetached } from "../../platform/osLauncher.js";

export interface OpenAppParams {
  target: string;
}

export const APP_ALIASES: Record<string, { win: string; mac: string; linux: string; canonicalId: string }> = {
  chrome: { win: "chrome.exe", mac: "Google Chrome", linux: "google-chrome", canonicalId: "chrome" },
  "google chrome": { win: "chrome.exe", mac: "Google Chrome", linux: "google-chrome", canonicalId: "chrome" },
  firefox: { win: "firefox.exe", mac: "Firefox", linux: "firefox", canonicalId: "firefox" },
  vscode: { win: "code.exe", mac: "Visual Studio Code", linux: "code", canonicalId: "vscode" },
  "vs code": { win: "code.exe", mac: "Visual Studio Code", linux: "code", canonicalId: "vscode" },
  "visual studio code": { win: "code.exe", mac: "Visual Studio Code", linux: "code", canonicalId: "vscode" },
  code: { win: "code.exe", mac: "Visual Studio Code", linux: "code", canonicalId: "vscode" },
  calculator: { win: "calc.exe", mac: "Calculator", linux: "gnome-calculator", canonicalId: "calculator" },
  calc: { win: "calc.exe", mac: "Calculator", linux: "gnome-calculator", canonicalId: "calculator" },
  notepad: { win: "notepad.exe", mac: "TextEdit", linux: "gedit", canonicalId: "notepad" },
  terminal: { win: "wt.exe", mac: "Terminal", linux: "x-terminal-emulator", canonicalId: "terminal" },
  explorer: { win: "explorer.exe", mac: "Finder", linux: "xdg-open", canonicalId: "explorer" },
  "file explorer": { win: "explorer.exe", mac: "Finder", linux: "xdg-open", canonicalId: "explorer" },
};

export class OpenAppSkill implements BaseSkill<OpenAppParams> {
  readonly id = "openApp";
  readonly name = "Launch Application";
  readonly description = "Launches an authorized native desktop application";
  readonly riskLevel = 0;

  validate(params: unknown): SkillValidationResult<OpenAppParams> {
    if (!params || typeof params !== "object") {
      return { valid: false, error: "Parameters must be an object with a 'target' string property." };
    }
    const target = (params as Record<string, unknown>).target;
    if (typeof target !== "string" || !target.trim()) {
      return { valid: false, error: "Target application must be a non-empty string." };
    }
    return { valid: true, data: { target: target.trim().toLowerCase() } };
  }

  async execute(params: OpenAppParams, context: SkillContext): Promise<SkillResult> {
    const rawTarget = params.target.toLowerCase();

    if (rawTarget === "whatsapp") {
      return {
        success: true,
        message: "Redirected to WhatsApp Web.",
        behaviorAction: "open_app:whatsapp",
      };
    }

    const alias = APP_ALIASES[rawTarget];
    if (!alias) {
      return {
        success: false,
        message: `I don't know how to open “${params.target}” yet. You can ask for Chrome, VS Code, Terminal, Notepad, Calculator, or File Explorer.`,
      };
    }

    if (context.isWsl && (rawTarget === "chrome" || rawTarget === "google chrome")) {
      const cmd = findWslCmd() || "cmd.exe";
      const res = await launchDetached(cmd, ["/c", "start", "chrome"], "Google Chrome");
      if (res.success) {
        return {
          ...res,
          behaviorAction: `open_app:${alias.canonicalId}`,
        };
      }
      const chromePath = findWslChrome();
      if (chromePath) {
        const res = await launchDetached(chromePath, [], "Google Chrome");
        return {
          ...res,
          behaviorAction: `open_app:${alias.canonicalId}`,
        };
      }
      return {
        success: false,
        message: "Google Chrome was not found in standard Windows install paths on this WSL system.",
      };
    }

    const currentOs = context.platform;
    const executable = currentOs === "win32" ? alias.win : currentOs === "darwin" ? "open" : alias.linux;
    const args = currentOs === "darwin" ? ["-a", alias.mac] : rawTarget.includes("explorer") && currentOs !== "win32" ? ["."] : [];

    const res = await launchDetached(executable, args, params.target);
    return {
      ...res,
      behaviorAction: res.success ? `open_app:${alias.canonicalId}` : undefined,
    };
  }
}
