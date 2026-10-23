export class PrivacySanitizer {
  private static BLOCKED_KEYS = new Set([
    "password",
    "token",
    "apikey",
    "auth",
    "secret",
    "body",
    "messagebody",
    "query",
    "credential",
    "credentials",
  ]);

  /**
   * Sanitizes an action identifier and its arguments into a privacy-safe canonical action key.
   * Strips query strings, paths, and private content.
   */
  public static sanitizeAction(intent: string, rawParams: Record<string, unknown> = {}): string {
    switch (intent) {
      case "app.launch":
      case "openApp": {
        const target = String(rawParams.appIdentifier || rawParams.target || "").trim().toLowerCase();
        return target ? `open_app:${target}` : "open_app:unknown";
      }

      case "web.navigate":
      case "openUrl": {
        try {
          const rawUrl = String(rawParams.url || "").trim();
          const parsed = new URL(rawUrl.startsWith("http://") || rawUrl.startsWith("https://") ? rawUrl : `https://${rawUrl}`);
          return `open_url:${parsed.hostname}`;
        } catch {
          return "open_url:invalid";
        }
      }

      case "web.search":
      case "webSearch":
        return "web_search";

      case "netflix.search":
      case "netflixSearch":
        return "netflix_search";

      case "comm.message":
      case "whatsApp":
        return "whatsapp_message";

      default:
        return intent;
    }
  }

  /**
   * Strips credentials, tokens, passwords, private message bodies, and sensitive fields from parameter maps.
   * Cleans URLs down to hostname only.
   */
  public static sanitizeParams(rawParams: Record<string, unknown> = {}): Record<string, unknown> {
    const clean: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(rawParams)) {
      const lowerKey = key.toLowerCase();
      if (PrivacySanitizer.BLOCKED_KEYS.has(lowerKey)) {
        continue;
      }
      if (/password|secret|token|apikey|auth|message|query|credential/i.test(key)) {
        continue;
      }

      if (typeof value === "string") {
        if (value.startsWith("http://") || value.startsWith("https://")) {
          try {
            clean[key] = new URL(value).hostname;
            continue;
          } catch {
            clean[key] = "invalid_url";
            continue;
          }
        }
      }

      clean[key] = value;
    }

    return clean;
  }

  /**
   * Redacts potential credentials, secrets, and raw communication message contents from user input text.
   */
  public static sanitizeInput(rawInput: string): string {
    let text = String(rawInput ?? "").trim();
    if (!text) return "";

    // 1. Redact credentials/tokens/passwords
    text = text.replace(
      /\b(password|passwd|token|bearer|secret|api[_-]?key)\s*[:=]\s*\S+/gi,
      "$1: [REDACTED]"
    );

    // 2. Redact communication message bodies: e.g. "send <msg> to <recipient>"
    text = text.replace(
      /\b((?:send|message|text|whatsapp)\s+)(["“'].+?["”']|.+?)(\s+to\s+)/i,
      "$1[REDACTED]$3"
    );

    return text;
  }
}
