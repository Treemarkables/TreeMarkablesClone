// On-photo text box. The words are typed in a textarea. A strip above the
// box moves it, and the corner and edge handles change the wrap size.
// Font size is not edited here.

import type { PointerEvent as ReactPointerEvent } from "react";
import type { TextBoxHandle } from "@/components/photoAnnotatorTextBox";

const HIT = 44;
const DOT = 16;

const HANDLES: { id: TextBoxHandle; x: string; y: string }[] = [
  { id: "nw", x: "0%", y: "0%" },
  { id: "n", x: "50%", y: "0%" },
  { id: "ne", x: "100%", y: "0%" },
  { id: "e", x: "100%", y: "50%" },
  { id: "se", x: "100%", y: "100%" },
  { id: "s", x: "50%", y: "100%" },
  { id: "sw", x: "0%", y: "100%" },
  { id: "w", x: "0%", y: "50%" },
];

export function PhotoAnnotatorTextBox({
  left,
  top,
  width,
  height,
  editing,
  value,
  color,
  fontSizePx,
  onChangeText,
  onCommit,
  onCancel,
  onHandlePointerDown,
  onBodyPointerDown,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
  editing: boolean;
  value: string;
  color: string;
  fontSizePx: number;
  onChangeText: (value: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  onHandlePointerDown: (
    handle: TextBoxHandle,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  onBodyPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const stripTop = top >= 32 ? top - 32 : top + height;
  const startHandle = (
    handle: TextBoxHandle,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.setPointerCapture) {
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // The pointer can already be gone on a very fast tap.
      }
    }
    onHandlePointerDown(handle, event);
  };

  return (
    <>
      <div
        className="absolute z-20 flex items-center justify-center touch-none"
        style={{
          left,
          top: stripTop,
          width: Math.max(1, width),
          height: 32,
          background: "rgba(0,0,0,0.55)",
          boxShadow: "0 0 0 2px white",
        }}
        onPointerDown={(event) => startHandle("move", event)}
        aria-label="Drag text"
        data-testid="handle-text-move"
      >
        <span className="block h-1 w-8 rounded-full bg-white/80" />
      </div>
      <div
        className="absolute z-20 touch-none"
        style={{
          left,
          top,
          width: Math.max(1, width),
          height: Math.max(1, height),
          boxShadow: "0 0 0 2px white",
        }}
        data-testid="box-annotate-text"
      >
        {editing ? (
          <textarea
            autoFocus
            value={value}
            onChange={(e) => onChangeText(e.target.value)}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onCommit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onCancel();
              }
            }}
            className="h-full w-full resize-none border-0 bg-black/25 p-1 font-bold outline-none"
            style={{
              color,
              fontSize: fontSizePx,
              lineHeight: 1.2,
              fontFamily: "Arial, sans-serif",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
              textShadow:
                "0 0 2px black, 0 0 2px black, 0 0 2px black, 0 0 2px black",
            }}
            data-testid="textarea-annotate-text"
          />
        ) : (
          <div
            className="h-full w-full"
            onPointerDown={onBodyPointerDown}
            data-testid="body-annotate-text"
          />
        )}
        {HANDLES.map((handle) => (
          <div
            key={handle.id}
            className="absolute z-30 flex items-center justify-center touch-none"
            style={{
              left: handle.x,
              top: handle.y,
              width: HIT,
              height: HIT,
              transform: "translate(-50%, -50%)",
            }}
            onPointerDown={(event) => startHandle(handle.id, event)}
            aria-label={`Resize text ${handle.id}`}
            data-testid={`handle-text-${handle.id}`}
          >
            <span
              className="block rounded-full border-2 border-neutral-900 bg-white"
              style={{ width: DOT, height: DOT }}
            />
          </div>
        ))}
      </div>
    </>
  );
}
