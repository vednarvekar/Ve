import { platform } from "node:os";
import type { SkillContext, SkillResult } from "../contracts/skillTypes.js";
import { IS_WSL } from "../platform/osLauncher.js";
import { SkillRegistry, defaultSkillRegistry } from "../registry/skillRegistry.js";

export class SkillRouter {
  constructor(private registry: SkillRegistry = defaultSkillRegistry) {}

  public async route(
    rawSkillId: string,
    rawParams: unknown,
    customContext?: Partial<SkillContext>
  ): Promise<SkillResult> {
    let skillId = rawSkillId;
    let params: unknown = rawParams;

    // Normalization layer: map legacy web intent IDs to the unified browser skill
    if (skillId === "openUrl" && params && typeof params === "object") {
      skillId = "browser";
      params = { action: "navigate", url: (params as any).url || (params as any).target };
    } else if (skillId === "webSearch" && params && typeof params === "object") {
      skillId = "browser";
      params = { action: "search", query: (params as any).query, provider: (params as any).engine || "google" };
    } else if (skillId === "netflixSearch" && params && typeof params === "object") {
      skillId = "browser";
      params = { action: "search", query: (params as any).query, provider: "netflix" };
    }

    const skill = this.registry.get(skillId);
    if (!skill) {
      return {
        success: false,
        message: `Unknown skill: "${skillId}".`,
        error: { code: "SKILL_NOT_FOUND", message: `Skill '${skillId}' is not registered.` },
      };
    }

    // 1. Parameter Validation Gate
    const validation = skill.validate(params);
    if (!validation.valid || validation.data === undefined) {
      return {
        success: false,
        message: validation.error || `Invalid parameters for skill "${skill.name}".`,
        error: { code: "VALIDATION_FAILED", message: validation.error || "Schema mismatch" },
      };
    }

    // 2. Build Context
    const context: SkillContext = {
      platform: platform(),
      isWsl: IS_WSL,
      timestamp: Date.now(),
      ...customContext,
    };

    // 3. Execution with Timeout & Error Boundary
    try {
      return await Promise.race([
        skill.execute(validation.data, context),
        new Promise<SkillResult>((_, reject) =>
          setTimeout(() => reject(new Error(`Execution of skill '${skill.name}' timed out after 10 seconds.`)), 10000)
        ),
      ]);
    } catch (err: any) {
      return {
        success: false,
        message: `Execution failed: ${err?.message || "Internal error"}`,
        error: {
          code: "EXECUTION_ERROR",
          message: err?.message || "Unknown error during skill execution",
        },
      };
    }
  }
}

export const defaultSkillRouter = new SkillRouter();
