const SKIP_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

export function isKeyboardField(
  tagName: string,
  inputType: string | null,
  contentEditable: boolean,
): boolean {
  if (tagName === "TEXTAREA" || tagName === "SELECT") return true;
  if (tagName === "INPUT") return !SKIP_INPUT_TYPES.has(inputType || "text");
  return contentEditable;
}

/** Phone keyboards cover the focused field. Scroll it into the visual viewport. */
export function shouldScrollFieldIntoView(
  target: EventTarget | null,
  viewportWidth: number,
): target is HTMLElement {
  if (viewportWidth >= 768) return false;
  if (typeof HTMLElement === "undefined" || !(target instanceof HTMLElement)) return false;
  const inputType = target instanceof HTMLInputElement ? target.type : null;
  return isKeyboardField(target.tagName, inputType, target.isContentEditable);
}

export function installMobileKeyboardScroll(doc: Document = document): () => void {
  const onFocus = (event: Event) => {
    const target = event.target;
    if (!shouldScrollFieldIntoView(target, window.innerWidth)) return;
    window.setTimeout(() => {
      if (!target.isConnected) return;
      target.scrollIntoView({ block: "center", inline: "nearest" });
    }, 300);
  };
  doc.addEventListener("focusin", onFocus);
  return () => doc.removeEventListener("focusin", onFocus);
}
