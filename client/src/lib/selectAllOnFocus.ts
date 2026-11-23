import { useRef } from "react";
import type { FocusEvent, MouseEvent } from "react";

function selectEntireValue(input: HTMLInputElement) {
  if (!input.value) return;
  input.select();
  try {
    input.setSelectionRange(0, input.value.length);
  } catch {
    // Some input types reject setSelectionRange; select() already ran.
  }
}

/**
 * First click (or Tab) into a filled input selects the whole value so typing
 * replaces it. The browser's mouseup after focus would otherwise drop the caret
 * and clear that selection. A later click, while the field is already focused,
 * can still place the caret.
 */
export function useSelectAllOnFocus() {
  const armSelectRef = useRef(false);

  return {
    onMouseDown: (event: MouseEvent<HTMLInputElement>) => {
      armSelectRef.current = document.activeElement !== event.currentTarget;
    },
    onFocus: (event: FocusEvent<HTMLInputElement>) => {
      selectEntireValue(event.currentTarget);
    },
    onMouseUp: (event: MouseEvent<HTMLInputElement>) => {
      if (!armSelectRef.current) return;
      event.preventDefault();
      selectEntireValue(event.currentTarget);
    },
    onClick: (event: MouseEvent<HTMLInputElement>) => {
      if (!armSelectRef.current) return;
      selectEntireValue(event.currentTarget);
      armSelectRef.current = false;
    },
  };
}
