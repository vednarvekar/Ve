const { contextBridge, ipcRenderer } = require("electron");

interface CommandResult {
  success: boolean;
  message: string;
}

contextBridge.exposeInMainWorld("ve", {
  runCommand: (input: string): Promise<CommandResult> =>
    ipcRenderer.invoke("ve:run-command", input),
});
