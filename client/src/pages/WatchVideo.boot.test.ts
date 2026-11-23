import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { isAppBooted } from "../lib/nativeBootRecovery.ts";
import { markWatchVideoBooted } from "./WatchVideo.tsx";

function installBootDom() {
  const attrs = new Map<string, string>();
  const overlay = {
    setAttribute(name: string, value: string) {
      attrs.set(name, value);
    },
    getAttribute(name: string) {
      return attrs.get(name) ?? null;
    },
  };
  const win = {
    dispatchEvent() {
      return true;
    },
    document: {
      getElementById(id: string) {
        return id === "inflow-boot" ? overlay : null;
      },
      documentElement: { dataset: {} as Record<string, string> },
    },
  };
  const g = globalThis as typeof globalThis & { window: Window; document: Document };
  g.window = win as unknown as Window;
  g.document = win.document as unknown as Document;
  return overlay;
}

describe("WatchVideo boot overlay", () => {
  beforeEach(() => {
    installBootDom();
  });

  it("marks booted with a title-less video", () => {
    assert.equal(isAppBooted(), false);
    markWatchVideoBooted({ title: null });
    assert.equal(isAppBooted(), true);
    const overlay = document.getElementById("inflow-boot");
    assert.equal(overlay?.getAttribute("data-booted"), "1");
  });

  it("marks booted while the fetch is still loading", () => {
    assert.equal(isAppBooted(), false);
    markWatchVideoBooted(null);
    assert.equal(isAppBooted(), true);
  });
});
