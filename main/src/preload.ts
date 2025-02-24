import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  test: () => "Hello from Electron!",
  getUsers: () => ipcRenderer.invoke("getUsers"),
  send: (channel: string, data: any) => ipcRenderer.send(channel, data),
  receive: (channel: string, callback: (data: any) => void) => {
    ipcRenderer.on(channel, (_event, data) => callback(data));
  },
});
