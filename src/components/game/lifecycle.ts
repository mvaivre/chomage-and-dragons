import type { Application } from "pixi.js";
const applications = new Set<Application>();
export function trackApplication(app: Application, onError?: (error: unknown) => void) {
  if (applications.has(app)) return;
  applications.add(app);
  const destroy = app.destroy.bind(app);
  let destroyed = false;
  const lost = () => { if (!destroyed) onError?.(new Error("Le contexte graphique 2D a été interrompu")); };
  app.canvas.addEventListener("webglcontextlost", lost);
  app.destroy = (...args: Parameters<Application["destroy"]>) => {
    if (destroyed) return;
    destroyed = true;
    app.canvas.removeEventListener("webglcontextlost", lost);
    try { destroy(...args); } finally {
      applications.delete(app);
      const host = window as unknown as Record<string, unknown>;
      if (host.__pixiApp === app) {
        delete host.__pixiApp; delete host.__decorScene; delete host.__viewportResidents;
      }
    }
  };
}
export const activeApplications = () => applications.size;
export async function releaseApplications() {
  // The Pixi reconciler destroys the app after committing its child removals.
  for (let frame = 0; frame < 8 && applications.size; frame++) await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  for (const app of applications) app.destroy();
}
