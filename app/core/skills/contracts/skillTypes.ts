export type SkillRiskLevel = 0 | 1 | 2 | 3;

export interface SkillContext {
  platform: NodeJS.Platform;
  isWsl: boolean;
  timestamp: number;
  contactsProvider?: (() => Promise<Array<{ name: string; phone: string }>>) | undefined;
  urlOpener?: ((url: string) => Promise<{ success: boolean; message: string }>) | undefined;
}

export interface SkillValidationResult<T> {
  valid: boolean;
  error?: string | undefined;
  data?: T | undefined;
}

export interface SkillResult<T = unknown> {
  success: boolean;
  message: string;
  data?: T | undefined;
  behaviorAction?: string | undefined;
  error?: {
    code: string;
    message: string;
  } | undefined;
}

export interface BaseSkill<TParams = unknown> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly riskLevel: SkillRiskLevel;

  validate(params: unknown): SkillValidationResult<TParams>;
  execute(params: TParams, context: SkillContext): Promise<SkillResult>;
}
