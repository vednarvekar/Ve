import { contextBridge, ipcRenderer } from "electron";

export interface CommandResult {
  success: boolean;
  message: string;
}

contextBridge.exposeInMainWorld("ve", {
  runCommand: (input: string): Promise<CommandResult> =>
    ipcRenderer.invoke("ve:run-command", input),
});
