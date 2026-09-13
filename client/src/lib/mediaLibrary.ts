// Bridge to the native MediaLibrary plugin (ios/App/App/MediaLibraryPlugin.swift):
// saves a photo/video URL straight into the iOS Photos library — no share sheet,
// no "download as file". The download happens natively, so large videos never
// have to fit in the WKWebView JS heap.
//
// The app shell loads the deployed site (capacitor.config server.url), so this
// code can run inside an OLDER native build that doesn't ship the plugin yet —
// always gate calls behind canSaveToPhotos() and keep a fallback path.
import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

interface MediaLibraryPlugin {
  saveToPhotos(options: {
    id: string;
    url: string;
    kind: "photo" | "video";
    filename?: string;
  }): Promise<{ saved: boolean }>;
  addListener(
    eventName: "saveProgress",
    listener: (progress: { id: string; percent: number }) => void,
  ): Promise<PluginListenerHandle>;
}

const MediaLibrary = registerPlugin<MediaLibraryPlugin>("MediaLibrary");

export function canSaveToPhotos(): boolean {
  const cap = (window as any).Capacitor;
  return (
    !!cap?.isNativePlatform?.() &&
    cap.getPlatform?.() === "ios" &&
    !!cap.isPluginAvailable?.("MediaLibrary")
  );
}

/** True when the failure was a Photos permission denial (surface the Settings hint). */
export function isPhotosPermissionError(err: unknown): boolean {
  return (err as any)?.code === "PERMISSION_DENIED";
}

export async function saveToPhotos(
  options: { id: string; url: string; kind: "photo" | "video"; filename?: string },
  onProgress?: (percent: number) => void,
): Promise<void> {
  let handle: PluginListenerHandle | undefined;
  if (onProgress) {
    handle = await MediaLibrary.addListener("saveProgress", (p) => {
      if (p.id === options.id) onProgress(p.percent);
    });
  }
  try {
    await MediaLibrary.saveToPhotos({
      ...options,
      // Native URLSession needs an absolute URL; media urls are app-relative (/objects/…).
      url: new URL(options.url, window.location.origin).toString(),
    });
  } finally {
    handle?.remove();
  }
}
