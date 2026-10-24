import type { Application } from "pixi.js"

/** Tear down a Pixi Application without throwing (handles partial init / Strict Mode). */
export function safeDestroyApplication(app: Application): void {
  try {
    const resizeTarget = app as Application & {
      resizeTo?: Window | HTMLElement | null
    }
    if (resizeTarget.resizeTo != null) {
      // Pixi ResizePlugin accepts null; types only list Window | HTMLElement.
      resizeTarget.resizeTo = null as unknown as HTMLElement
    }
  } catch {
    // ResizePlugin may not be initialized yet.
  }

  const canvas = app.renderer?.canvas
  try {
    canvas?.remove()
  } catch {
    // ignore
  }

  if (!app.renderer) {
    return
  }

  try {
    app.destroy(true, { children: true })
  } catch {
    try {
      app.renderer.destroy(true)
    } catch {
      // Best-effort cleanup after a failed destroy (e.g. init race).
    }
  }
}
