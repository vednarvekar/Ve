import { platform } from "node:os";
import type { BaseSkill, SkillContext, SkillResult, SkillValidationResult } from "../../contracts/skillTypes.js";
import { findWslChrome, launchDetached } from "../../platform/osLauncher.js";
import { buildSearchUrl, normalizeBrowserTarget, type SearchProvider } from "./providerUrls.js";

export type BrowserAction = "navigate" | "search";

export interface BrowserParams {
  action: BrowserAction;
  url?: string | undefined;
  query?: string | undefined;
  provider?: SearchProvider | undefined;
}

export class BrowserSkill implements BaseSkill<BrowserParams> {
  readonly id = "browser";
  readonly name = "Browser & Web Automation";
  readonly description = "Navigates websites, opens web pages, and searches providers (Google, YouTube, Netflix, GitHub, etc.)";
  readonly riskLevel = 1;

  validate(params: unknown): SkillValidationResult<BrowserParams> {
    if (!params || typeof params !== "object") {
      return { valid: false, error: "Parameters must be an object with an 'action' property." };
    }
    const p = params as Record<string, unknown>;
    const action = String(p.action || "").toLowerCase().trim();

    if (action === "navigate") {
      const url = typeof p.url === "string" ? p.url.trim() : "";
      if (!url) {
        return { valid: false, error: "A URL or website name is required for browser navigation." };
      }
      return { valid: true, data: { action: "navigate", url } };
    }

    if (action === "search") {
      const query = typeof p.query === "string" ? p.query.trim() : "";
      if (!query) {
        return { valid: false, error: "Search query cannot be empty." };
      }
      const provider = typeof p.provider === "string" ? (p.provider.trim() as SearchProvider) : "google";
      return { valid: true, data: { action: "search", query, provider } };
    }

    return { valid: false, error: `Unsupported browser action: "${p.action}". Valid actions are 'navigate' and 'search'.` };
  }

  async execute(params: BrowserParams, context: SkillContext): Promise<SkillResult> {
    let targetUrl: string;
    let successMessage: string;
    let behaviorAction: string;

    if (params.action === "search") {
      const query = params.query!;
      const provider = params.provider || "google";
      targetUrl = buildSearchUrl(query, provider);
      successMessage = provider === "google"
        ? `Searching for “${query}”.`
        : `Searching ${provider.charAt(0).toUpperCase() + provider.slice(1)} for “${query}”.`;
      behaviorAction = provider === "netflix" ? "netflix_search" : "web_search";
    } else {
      targetUrl = normalizeBrowserTarget(params.url!);
      successMessage = `Opened ${targetUrl}.`;
      behaviorAction = "open_url";
    }

    // Verify protocol
    try {
      const parsed = new URL(targetUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return { success: false, message: "Only HTTP and HTTPS URLs can be opened." };
      }
    } catch {
      return { success: false, message: `Invalid URL: "${targetUrl}".` };
    }

    // Custom injected opener if provided (e.g. In tests or custom runner)
    if (context.urlOpener) {
      const res = await context.urlOpener(targetUrl);
      return {
        ...res,
        message: res.success ? successMessage : res.message,
        behaviorAction: res.success ? behaviorAction : undefined,
      };
    }

    // WSL Environment handling
    if (context.isWsl) {
      const chromePath = findWslChrome();
      if (chromePath) {
        const res = await launchDetached(chromePath, [targetUrl], "Google Chrome");
        return {
          ...res,
          message: res.success ? successMessage : res.message,
          behaviorAction: res.success ? behaviorAction : undefined,
        };
      }
      return {
        success: false,
        message: "Could not find host Windows Chrome in WSL environment to open this URL.",
      };
    }

    // Electron environment
    try {
      const electron = await import("electron").catch(() => null);
      if (electron?.shell?.openExternal) {
        await electron.shell.openExternal(targetUrl);
        return {
          success: true,
          message: successMessage,
          behaviorAction,
        };
      }
    } catch {
      // Fall through to native OS launcher
    }

    // Native OS launch fallback
    const currentOs = platform();
    const launcher = currentOs === "win32" ? "cmd.exe" : currentOs === "darwin" ? "open" : "xdg-open";
    const args = currentOs === "win32" ? ["/c", "start", "", targetUrl] : [targetUrl];
    const res = await launchDetached(launcher, args, "Browser");
    return {
      ...res,
      message: res.success ? successMessage : res.message,
      behaviorAction: res.success ? behaviorAction : undefined,
    };
  }
}
