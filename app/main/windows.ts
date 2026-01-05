import { BrowserWindow } from "electron";
import path from "path";

export function createMainWindow(): BrowserWindow {
  const preloadPath = path.resolve(__dirname, "..", "preload", "bridge.js");

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      sandbox: false
    }
  });

  // Load renderer from DIST
  void win.loadFile(path.resolve(__dirname, "..", "renderer", "index.html"));

  return win;
}