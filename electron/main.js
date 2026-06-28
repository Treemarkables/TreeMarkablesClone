// Inflow desktop — Electron shell.
//
// Like the iOS/Android Capacitor shells, this loads the live web app from
// https://app.treemarkables.co.nz rather than bundling assets. It is essentially the
// website in a dedicated, branded window with native menus and proper external-link
// handling. There is NO Twilio Voice / FCM here — those are mobile-SDK features and
// don't exist on desktop (see DESKTOP_BUILD_GUIDE.md).

const { app, BrowserWindow, Menu, shell, session } = require("electron");
const path = require("path");

// MANAGED: app-shell container URL. Change via appShell.config.json +
// `node scripts/sync-app-shell-url.mjs`, not by hand.
const APP_URL = "https://app.treemarkables.co.nz";
const APP_ORIGIN = new URL(APP_URL).origin;

// Single-instance: focus the existing window instead of opening a second one.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#1a1a1a",
    title: "Inflow",
    icon: path.join(__dirname, "assets", process.platform === "win32" ? "icon.ico" : "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // The web app uses the camera/mic for photos and (browser) calls.
      spellcheck: true,
    },
  });

  mainWindow.loadURL(APP_URL);

  // Auto-grant the permissions the web app legitimately needs (camera/mic for
  // photos & WebRTC, notifications). Deny everything else.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    const allowed = ["media", "notifications", "clipboard-read", "clipboard-sanitized-write"];
    callback(allowed.includes(permission));
  });

  // Open off-origin links (mailto, external sites, OAuth popups to other domains)
  // in the user's real browser instead of inside the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      if (new URL(url).origin !== APP_ORIGIN) {
        shell.openExternal(url);
        return { action: "deny" };
      }
    } catch (_) {
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Keep top-level navigation inside our origin; bounce the rest to the browser.
  mainWindow.webContents.on("will-navigate", (event, url) => {
    try {
      if (new URL(url).origin !== APP_ORIGIN) {
        event.preventDefault();
        shell.openExternal(url);
      }
    } catch (_) {
      event.preventDefault();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    { role: "fileMenu" },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        {
          label: "Open Inflow in Browser",
          click: () => shell.openExternal(APP_URL),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
