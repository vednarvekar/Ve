const { contextBridge, ipcRenderer } = require("electron");

interface CommandResult {
  success: boolean;
  message: string;
}

contextBridge.exposeInMainWorld("ve", {
  runCommand: (input: string): Promise<CommandResult> =>
    ipcRenderer.invoke("ve:run-command", input),
  listMemories: () => ipcRenderer.invoke("ve:list-memories"),
  addMemory: (text: string) => ipcRenderer.invoke("ve:add-memory", text),
  deleteMemory: (id: string) => ipcRenderer.invoke("ve:delete-memory", id),
  listContacts: () => ipcRenderer.invoke("ve:list-contacts"),
  addContact: (name: string, phone: string) => ipcRenderer.invoke("ve:add-contact", name, phone),
  deleteContact: (id: string) => ipcRenderer.invoke("ve:delete-contact", id),
  getPredictionState: () => ipcRenderer.invoke("ve:get-prediction-state"),
  clearBehavior: () => ipcRenderer.invoke("ve:clear-behavior"),
  setOrbMenuVisible: (visible: boolean) => ipcRenderer.invoke("ve:orb-menu-visible", visible),
  orbOpenChat: () => ipcRenderer.invoke("ve:orb-open-chat"),
  orbHide: () => ipcRenderer.invoke("ve:orb-hide"),
  getOrbPosition: () => ipcRenderer.invoke("ve:orb-get-position"),
  moveOrb: (x: number, y: number): Promise<{ x: number; y: number }> => ipcRenderer.invoke("ve:orb-move", x, y),
  orbSavePosition: () => ipcRenderer.invoke("ve:orb-save-position"),
  onOrbMenuState: (callback: (visible: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, visible: unknown) => {
      if (typeof visible === "boolean") callback(visible);
    };
    ipcRenderer.on("ve:orb-menu-state", listener);
    return () => ipcRenderer.removeListener("ve:orb-menu-state", listener);
  },
});
