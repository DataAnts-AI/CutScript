/// <reference types="vite/client" />

interface ElectronAPI {
  openFile: (options?: Record<string, unknown>) => Promise<string | null>;
  saveFile: (options?: Record<string, unknown>) => Promise<string | null>;
  openProject: () => Promise<string | null>;
  getBackendUrl: () => Promise<string>;
  encryptString: (data: string) => Promise<string>;
  decryptString: (encrypted: string) => Promise<string>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string) => Promise<boolean>;
}

interface Window {
  electronAPI?: ElectronAPI;
}
