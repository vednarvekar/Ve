import type { IpcMainInvokeEvent } from "electron";

/**
 * Reject IPC from iframes, navigated pages, and any renderer other than Ve's
 * exact local entry point. Main-process handlers must all use this wrapper.
 */
export function guardTrustedRendererIpc<TArgs extends unknown[], TResult>(
  trustedRendererUrl: string | readonly string[],
  handler: (event: IpcMainInvokeEvent, ...args: TArgs) => TResult
): (event: IpcMainInvokeEvent, ...args: TArgs) => TResult {
  return (event, ...args) => {
    const frame = event.senderFrame;
    if (!frame || frame !== event.sender.mainFrame || !isTrustedRendererUrl(trustedRendererUrl, frame.url)) {
      throw new Error("Rejected IPC request from an untrusted renderer frame.");
    }
    return handler(event, ...args);
  };
}

export function isTrustedRendererUrl(trustedRendererUrl: string | readonly string[], candidateUrl: string): boolean {
  return typeof trustedRendererUrl === "string"
    ? candidateUrl === trustedRendererUrl
    : trustedRendererUrl.includes(candidateUrl);
}

export function isBoundedString(
  value: unknown,
  maxLength: number,
  allowEmpty = false
): value is string {
  return typeof value === "string" && value.length <= maxLength && (allowEmpty || value.trim().length > 0);
}
