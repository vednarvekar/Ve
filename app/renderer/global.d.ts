export interface CommandResult {
  success: boolean;
  message: string;
}

declare global {
  interface VeBridge {
    runCommand(input: string): Promise<CommandResult>;
  }

  interface Window {
    ve: VeBridge;
  }
}
