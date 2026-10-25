export interface CommandResult {
  success: boolean;
  message: string;
  command?: { skill: string; params: Record<string, string> };
}

declare global {
  interface VeBridge {
    runCommand(input: string): Promise<CommandResult>;
    listMemories(): Promise<Array<{ id: string; text: string; createdAt: number }>>;
    addMemory(text: string): Promise<{ id: string; text: string; createdAt: number }>;
    deleteMemory(id: string): Promise<void>;
    listContacts(): Promise<Array<{ id: string; name: string; phone: string }>>;
    addContact(name: string, phone: string): Promise<{ id: string; name: string; phone: string }>;
    deleteContact(id: string): Promise<void>;
    getPredictionState(): Promise<{ sampleCount: number; suggestions: string[] }>;
    clearBehavior(): Promise<void>;
    setOrbMenuVisible(visible: boolean): Promise<void>;
    orbOpenChat(): Promise<void>;
    orbHide(): Promise<void>;
    showOrb(): Promise<void>;
    getOrbPosition(): Promise<{ x: number; y: number }>;
    moveOrb(x: number, y: number): Promise<{ x: number; y: number }>;
    dragOrb(x: number, y: number): void;
    orbSavePosition(): Promise<void>;
    onOrbMenuState(callback: (visible: boolean) => void): () => void;
  }

  interface Window {
    ve: VeBridge;
  }
}
