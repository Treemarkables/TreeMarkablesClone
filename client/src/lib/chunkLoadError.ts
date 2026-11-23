// Pure chunk-miss detection. No other local imports: the Node test runner
// loads this file directly, and extensionless imports do not resolve there.

export function isChunkLoadError(error: Error | null | undefined): boolean {
  const msg = error?.message || "";
  const name = error?.name || "";
  return name === "ChunkLoadError" || isChunkLoadErrorMessage(msg);
}

export function isChunkLoadErrorMessage(msg: string): boolean {
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("Loading chunk") ||
    msg.includes("ChunkLoadError")
  );
}

/**
 * A `<script>` error whose URL is a Vite hashed file.
 * WebKit reports a module 404 as "Load failed" with the script URL in
 * `filename`, which is not one of the dynamic-import strings above.
 * A bare "Load failed" from `fetch()` has no /assets/ filename and must
 * not reload the app.
 */
export function isAssetScriptFailure(message: string, filename?: string): boolean {
  if (isChunkLoadErrorMessage(message)) return true;
  if (!filename || !filename.includes("/assets/")) return false;
  return message.includes("SyntaxError") || message.includes("Load failed");
}
