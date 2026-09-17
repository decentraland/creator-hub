// The live 3D viewport element's screen rect, exposed to the host so it can crop a
// compositor screenshot to just the viewport (#1526). The Bevy engine renders into a wgpu
// canvas that `canvas.toDataURL()` can't read, so when the engine's own `/screenshot`
// command is unavailable the host falls back to Electron's `webContents.capturePage(rect)`
// — but only the inspector knows where the viewport sits inside its (cross-origin) iframe.
// Renderer.tsx registers its viewport container; the scene-RPC `get_viewport_rect` reads it.

let viewportEl: HTMLElement | null = null;

export function setViewportElement(el: HTMLElement | null): void {
  viewportEl = el;
}

export interface ViewportRect {
  x: number;
  y: number;
  width: number;
  height: number;
  devicePixelRatio: number;
}

// The viewport's rect in the inspector window's own coordinates (CSS px). The host adds the
// inspector iframe's offset to place it in the top-level window for capturePage. Null when
// no viewport is mounted (e.g. before load).
export function getViewportRect(): ViewportRect | null {
  if (viewportEl === null) return null;
  const r = viewportEl.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return {
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    devicePixelRatio: window.devicePixelRatio || 1,
  };
}
