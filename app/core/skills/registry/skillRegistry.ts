import type { BaseSkill } from "../contracts/skillTypes.js";
import { OpenAppSkill } from "../modules/openApp/index.js";
import { BrowserSkill } from "../modules/browser/index.js";
import { WhatsAppSkill } from "../modules/whatsApp/index.js";

export class SkillRegistry {
  private skills: Map<string, BaseSkill<any>> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    this.register(new OpenAppSkill());
    this.register(new BrowserSkill());
    this.register(new WhatsAppSkill());
  }

  public register(skill: BaseSkill<any>): void {
    if (this.skills.has(skill.id)) {
      console.warn(`Overwriting previously registered skill '${skill.id}'.`);
    }
    this.skills.set(skill.id, skill);
  }

  public get(id: string): BaseSkill<any> | undefined {
    return this.skills.get(id);
  }

  public has(id: string): boolean {
    return this.skills.has(id);
  }

  public listSkills(): Array<{ id: string; name: string; description: string; riskLevel: number }> {
    return Array.from(this.skills.values()).map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      riskLevel: skill.riskLevel,
    }));
  }
}

export const defaultSkillRegistry = new SkillRegistry();
