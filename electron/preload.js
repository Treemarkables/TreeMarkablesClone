// Minimal, locked-down preload. The web app is a normal website here, so it needs no
// privileged bridge. We only expose a tiny, read-only marker so the web layer can detect
// it's running inside the desktop shell if it ever wants to (e.g. to hide "install app"
// banners). Keep contextIsolation ON and never expose Node APIs to the page.

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("inflowDesktop", {
  isDesktop: true,
  platform: process.platform,
});
