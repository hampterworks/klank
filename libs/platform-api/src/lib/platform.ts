/**
 * True when running inside a Tauri webview (desktop or Android), false in a
 * plain browser loading the server-mode SPA. Every service factory branches on
 * this to pick the Tauri IPC implementation or the HTTP (`/api/...`) one.
 */
export const isTauri = (): boolean => {
  const win = (globalThis as { window?: object }).window
  return win != null && '__TAURI_INTERNALS__' in win
}
