import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  chooseMediaSaveStrategy,
  isIOSUserAgent,
  isShareBlocked,
  isShareDismissed,
  readResponseAsFile,
  saveFailureCopy,
  savePlatformFrom,
  type SavePlatform,
} from "./saveMedia.ts";

const web: SavePlatform = { canSaveToPhotos: false, nativePlatform: null, isIOS: false };
const iosSafari: SavePlatform = { canSaveToPhotos: false, nativePlatform: null, isIOS: true };
const capIOS: SavePlatform = { canSaveToPhotos: false, nativePlatform: "ios", isIOS: true };
const capIOSPhotos: SavePlatform = { canSaveToPhotos: true, nativePlatform: "ios", isIOS: true };
const capAndroid: SavePlatform = { canSaveToPhotos: false, nativePlatform: "android", isIOS: false };

describe("savePlatformFrom", () => {
  it("matches the Photos plugin gate: native iOS with MediaLibrary", () => {
    const withPlugin = savePlatformFrom({
      isNative: true,
      platform: "ios",
      mediaLibraryPlugin: true,
      ua: "iPhone",
      navPlatform: "iPhone",
      maxTouchPoints: 5,
    });
    assert.equal(withPlugin.canSaveToPhotos, true);
    assert.equal(chooseMediaSaveStrategy("video", withPlugin), "photos");

    const olderBuild = savePlatformFrom({
      isNative: true,
      platform: "ios",
      mediaLibraryPlugin: false,
      ua: "iPhone",
      navPlatform: "iPhone",
      maxTouchPoints: 5,
    });
    assert.equal(olderBuild.canSaveToPhotos, false);
    assert.equal(chooseMediaSaveStrategy("video", olderBuild), "share-file");
  });
});

describe("chooseMediaSaveStrategy", () => {
  it("keeps the desktop anchor download — no file-picker API", () => {
    assert.equal(chooseMediaSaveStrategy("video", web), "anchor");
    assert.equal(chooseMediaSaveStrategy("photo", web), "anchor");
  });

  it("saves straight to Photos when the native plugin is in the build", () => {
    assert.equal(chooseMediaSaveStrategy("video", capIOSPhotos), "photos");
    assert.equal(chooseMediaSaveStrategy("photo", capIOSPhotos), "photos");
  });

  it("uses the share sheet on Capacitor iOS when Photos saving isn't available", () => {
    assert.equal(chooseMediaSaveStrategy("video", capIOS), "share-file");
    assert.equal(chooseMediaSaveStrategy("photo", capIOS), "share-file");
  });

  it("uses the share sheet for videos in iOS Safari", () => {
    assert.equal(chooseMediaSaveStrategy("video", iosSafari), "share-file");
    assert.equal(chooseMediaSaveStrategy("photo", iosSafari), "anchor");
  });

  it("lets the Android shell download videos, and shares photos", () => {
    assert.equal(chooseMediaSaveStrategy("video", capAndroid), "android-attachment");
    assert.equal(chooseMediaSaveStrategy("photo", capAndroid), "share-file");
  });
});

describe("iOS detection", () => {
  it("recognises iPhone and iPadOS-as-Mac", () => {
    assert.equal(isIOSUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", "iPhone", 5), true);
    assert.equal(isIOSUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 5), true);
    assert.equal(isIOSUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 0), false);
  });
});

describe("share failure copy", () => {
  const webkitMessage =
    "The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission.";

  it("does not repeat the WebKit permission string", () => {
    const err = new DOMException(webkitMessage, "NotAllowedError");
    assert.equal(isShareBlocked(err), true);
    const copy = saveFailureCopy("video", err);
    assert.equal(copy.title, "Could not save video");
    assert.equal(copy.description.includes("not allowed by the user agent"), false);
    assert.match(copy.description, /share sheet/i);
  });

  it("treats a closed share sheet as a dismissal", () => {
    const err = new DOMException("Share canceled", "AbortError");
    assert.equal(isShareDismissed(err), true);
    assert.equal(isShareBlocked(err), false);
  });

  it("keeps a useful download error", () => {
    const copy = saveFailureCopy("video", new Error("The file could not be downloaded. Check your connection and try again."));
    assert.equal(copy.description, "The file could not be downloaded. Check your connection and try again.");
  });
});

describe("readResponseAsFile", () => {
  it("builds a named file and reports percent", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const res = new Response(bytes, {
      headers: { "content-type": "video/mp4", "content-length": "4" },
    });
    const percents: number[] = [];
    const file = await readResponseAsFile(res, "clip.mp4", "application/octet-stream", (p) => percents.push(p));
    assert.equal(file.name, "clip.mp4");
    assert.equal(file.type, "video/mp4");
    assert.equal(file.size, 4);
    assert.equal(percents.at(-1), 100);
  });
});
