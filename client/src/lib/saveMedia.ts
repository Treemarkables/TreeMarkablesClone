// How the media library (and the videos page) save a photo or video.
//
// There is no File System Access API (`showSaveFilePicker`) in this app.
// Desktop browsers save with a normal anchor download. iOS cannot: Safari
// ignores `<a download>` for videos, and the Capacitor WKWebView ignores
// Content-Disposition: attachment and just plays the file.
//
// On those devices the save is `navigator.share({ files })` ("Save Video" /
// "Save to Files"). WebKit only allows that call during the tap that started
// it. Downloading a job video takes longer than the tap stays valid, so share
// rejects with NotAllowedError and this exact message:
//   "The request is not allowed by the user agent or the platform in the
//    current context, possibly because the user denied permission."
// That is not a Photos permission denial. Stage the file and open the sheet
// on the next tap, while the gesture is still fresh.
//
// Builds that ship the MediaLibrary plugin skip this and write straight to
// Photos (`canSaveToPhotos` in mediaLibrary.ts). That path is unchanged.
// `savePlatformFrom` must stay equivalent to that check: native iOS and the
// MediaLibrary plugin both present.

export type MediaKind = "photo" | "video";
export type NativePlatform = "ios" | "android" | null;

export interface SavePlatform {
  canSaveToPhotos: boolean;
  nativePlatform: NativePlatform;
  /** iPhone, iPod, iPad, or iPadOS reporting itself as a Mac. */
  isIOS: boolean;
}

export type MediaSaveStrategy = "photos" | "android-attachment" | "share-file" | "anchor";

export function isIOSUserAgent(ua: string, platform: string, maxTouchPoints: number): boolean {
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ sends a desktop Mac user agent; touch points tell them apart.
  return platform === "MacIntel" && maxTouchPoints > 1;
}

export function savePlatformFrom(input: {
  isNative: boolean;
  platform: string | null;
  mediaLibraryPlugin: boolean;
  ua: string;
  navPlatform: string;
  maxTouchPoints: number;
}): SavePlatform {
  const nativePlatform: NativePlatform =
    input.isNative && (input.platform === "ios" || input.platform === "android") ? input.platform : null;
  return {
    canSaveToPhotos: input.isNative && input.platform === "ios" && input.mediaLibraryPlugin,
    nativePlatform,
    isIOS: isIOSUserAgent(input.ua, input.navPlatform, input.maxTouchPoints),
  };
}

export function currentSavePlatform(): SavePlatform {
  const cap = (window as Window & {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
      isPluginAvailable?: (name: string) => boolean;
    };
  }).Capacitor;
  return savePlatformFrom({
    isNative: !!cap?.isNativePlatform?.(),
    platform: cap?.getPlatform?.() ?? null,
    mediaLibraryPlugin: !!cap?.isPluginAvailable?.("MediaLibrary"),
    ua: navigator.userAgent || "",
    navPlatform: navigator.platform || "",
    maxTouchPoints: navigator.maxTouchPoints || 0,
  });
}

export function chooseMediaSaveStrategy(kind: MediaKind, platform: SavePlatform): MediaSaveStrategy {
  if (platform.canSaveToPhotos) return "photos";
  // Android shell: an attachment response hits the WebView DownloadListener
  // without unloading the page. Photos still go through the share sheet.
  if (platform.nativePlatform === "android" && kind === "video") return "android-attachment";
  // Capacitor iOS without the Photos plugin, and Android photos.
  if (platform.nativePlatform === "ios" || platform.nativePlatform === "android") return "share-file";
  // Mobile Safari (and Chrome-on-iOS, which is WebKit): anchor download does
  // not save a video. The share sheet does, once the file is already in memory.
  if (platform.isIOS && kind === "video") return "share-file";
  return "anchor";
}

/** User closed the share sheet. Not a failure. */
export function isShareDismissed(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { name?: string }).name === "AbortError";
}

/**
 * WebKit rejected `navigator.share`. The message looks like a permission
 * denial; on this screen it means the tap expired during the download, or
 * this WebView will not open the file share sheet.
 */
export function isShareBlocked(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { name?: string; message?: string };
  if (e.name === "NotAllowedError") return true;
  return typeof e.message === "string" && /not allowed by the user agent or the platform/i.test(e.message);
}

export function saveFailureCopy(kind: MediaKind, err: unknown): { title: string; description: string } {
  const title = kind === "video" ? "Could not save video" : "Could not save photo";
  if (isShareBlocked(err)) {
    return {
      title,
      description:
        kind === "video"
          ? "iOS blocked the share sheet. Try again, or update the Inflow app so videos save straight to Photos."
          : "iOS blocked the share sheet. Try again, or update the Inflow app so photos save straight to Photos.",
    };
  }
  const message =
    typeof err === "object" && err !== null && typeof (err as { message?: unknown }).message === "string"
      ? (err as { message: string }).message
      : "";
  return { title, description: message || "Please try again." };
}

export function shareUnavailableCopy(kind: MediaKind): { title: string; description: string } {
  const title = kind === "video" ? "Could not save video" : "Could not save photo";
  return {
    title,
    description:
      kind === "video"
        ? "This app version can't open the share sheet for videos. Update Inflow so they save straight to Photos."
        : "This app version can't open the share sheet for photos. Update Inflow so they save straight to Photos.",
  };
}

export function canShareFiles(file: File): boolean {
  return typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
}

/** Read a media response into a File, reporting download percent when the length is known. */
export async function readResponseAsFile(
  res: Response,
  filename: string,
  fallbackType: string,
  onProgress?: (percent: number) => void,
): Promise<File> {
  if (!res.ok || !res.body) {
    throw new Error("The file could not be downloaded. Check your connection and try again.");
  }
  const total = Number(res.headers.get("content-length") || 0);
  const reader = res.body.getReader();
  const chunks: BlobPart[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    // Copy into a plain ArrayBuffer. A Uint8Array from the reader isn't always
    // accepted as a BlobPart under current TypeScript DOM types.
    const copy = new ArrayBuffer(value.byteLength);
    new Uint8Array(copy).set(value);
    chunks.push(copy);
    loaded += value.byteLength;
    if (total > 0 && onProgress) {
      onProgress(Math.min(100, Math.round((loaded / total) * 100)));
    }
  }
  const headerType = res.headers.get("content-type");
  const type = headerType && headerType !== "application/octet-stream" ? headerType : fallbackType;
  return new File(chunks, filename, { type });
}
