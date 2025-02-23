import { contextBridge, ipcRenderer } from "electron";
// import { ElectronAPI } from "../../shared"; // ✅ Adjusted relative path

contextBridge.exposeInMainWorld("electron", {
  send: (channel: string, data: any) => ipcRenderer.send(channel, data),
  receive: (channel: string, func: (data: any) => void) =>
    ipcRenderer.on(channel, (_, data) => func(data)),

  // Database functions
  test: () => "Electron is running!", // Test function,
  getUsers: () => ipcRenderer.invoke("getUsers"),
  addUser: (email: string, password: string, name: string) =>
    ipcRenderer.invoke("addUser", email, password, name),
});
