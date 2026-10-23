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
});
