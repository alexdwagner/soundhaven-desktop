import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// Define the types for the exposed APIs
declare global {
  interface Window {
    electron: {
      // IPC Renderer methods
      ipcRenderer: {
        invoke(channel: string, ...args: any[]): Promise<any>;
        on(channel: string, listener: (event: IpcRendererEvent, ...args: any[]) => void): void;
        removeListener(channel: string, listener: (...args: any[]) => void): void;
      };
      // Direct API methods
      getTracks(): Promise<any>;
      getUser(): Promise<any>;
      // Add other direct methods as needed
    };
  }
}

// Whitelist of valid channels for IPC communication
const validChannels = [
  'getUsers',
  'getUser',
  'getTracks',
  'getPlaylists',
  'auth:login',
  'auth:register',
  'auth:refresh',
  'api-request',
  'debug:test',
  'upload:single-track',
  'upload:batch-tracks',
  'get-file-url',
  'db:check-integrity',
  'db:cleanup-orphaned',
  'db:fix-paths',
  'db:sync'
];

// Helper function to safely invoke IPC methods
const safeInvoke = (channel: string, ...args: any[]) => {
  if (validChannels.includes(channel)) {
    return ipcRenderer.invoke(channel, ...args);
  }
  return Promise.reject(new Error(`Invalid channel: ${channel}`));
};

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Direct method implementations
  getTracks: () => safeInvoke('getTracks'),
  getUser: () => safeInvoke('getUser'),
  
  // IPC Renderer interface
  ipcRenderer: {
    // Invoke method for two-way communication
    invoke: safeInvoke,
    
    // On method for listening to events
    on(channel: string, listener: (...args: any[]) => void) {
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, listener);
      }
    },
    
    // Remove listener
    removeListener(channel: string, listener: (...args: any[]) => void) {
      if (validChannels.includes(channel)) {
        ipcRenderer.removeListener(channel, listener);
      }
    },
  },
});
