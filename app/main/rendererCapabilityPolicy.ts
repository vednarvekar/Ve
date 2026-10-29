export type RendererRole = "chat" | "orb" | "menu";

/**
 * Main-process capability allowlist for renderer-to-main IPC. A renderer's
 * local URL alone does not grant it every capability exposed by the preload.
 */
export const IPC_CAPABILITY_POLICY = {
  "ve:run-command": ["chat"],
  "ve:list-memories": ["chat"],
  "ve:add-memory": ["chat"],
  "ve:delete-memory": ["chat"],
  "ve:list-contacts": ["chat"],
  "ve:add-contact": ["chat"],
  "ve:delete-contact": ["chat"],
  "ve:get-prediction-state": ["chat"],
  "ve:clear-behavior": ["chat"],
  "ve:orb-menu-visible": ["orb", "menu"],
  "ve:orb-open-chat": ["menu"],
  "ve:orb-hide": ["menu"],
  "ve:show-orb": ["chat"],
  "ve:orb-get-position": ["orb", "menu"],
  "ve:orb-move": ["orb", "menu"],
  "ve:orb-drag-position": ["orb"],
  "ve:orb-drag-finish": ["orb"],
  "ve:orb-save-position": ["orb", "menu"],
} as const satisfies Record<string, readonly RendererRole[]>;

export type IpcCapability = keyof typeof IPC_CAPABILITY_POLICY;

export function isRendererCapabilityAllowed(channel: string, role: RendererRole): boolean {
  const allowedRoles: readonly RendererRole[] | undefined = IPC_CAPABILITY_POLICY[channel as IpcCapability];
  return allowedRoles?.includes(role) ?? false;
}

export function trustedRendererUrlsForChannel(
  channel: string,
  rendererUrls: Record<RendererRole, string>
): string[] {
  const roles = IPC_CAPABILITY_POLICY[channel as IpcCapability];
  if (!roles) throw new Error(`No renderer capability policy is registered for IPC channel "${channel}".`);
  return roles.map((role) => rendererUrls[role]);
}
