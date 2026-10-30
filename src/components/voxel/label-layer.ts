import type { WorldLabel } from "./engine";
import { ENVIRONMENT_LABELS, type EnvironmentKind } from "@/lib/game/environment";

type Entry = { node: HTMLElement; label: WorldLabel; frame: number; transform: string; me: boolean };

/** Frame-synchronous overlay owned by the renderer. React owns the surrounding UI,
 * never the moving coordinates. Stable nodes retain keyboard focus and listeners. */
export class WorldLabelLayer {
  private entries = new Map<string, Entry>();
  private frame = 0;
  constructor(private host: HTMLElement, private activate: (label: WorldLabel) => void) {
    host.addEventListener("click", this.click);
  }
  private click = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-world-label]");
    const entry = button && this.entries.get(button.dataset.worldLabel!);
    if (entry && this.host.contains(button)) this.activate(entry.label);
  };
  update(labels: readonly WorldLabel[], meId: string | null) {
    this.frame++;
    for (const label of labels) {
      let entry = this.entries.get(label.id);
      const me = label.kind === "player" && label.id === meId;
      if (!entry) {
        const node = document.createElement(label.kind === "player" ? "span" : "button");
        node.dataset.worldLabel = label.id;
        if (node instanceof HTMLButtonElement) { node.type = "button"; node.dataset.worldObject = label.id; }
        else node.dataset.playerId = label.id;
        entry = { node, label, frame: 0, transform: "", me: !me };
        this.entries.set(label.id, entry); this.host.appendChild(node);
      }
      const { node } = entry;
      if (entry.frame === 0 || entry.me !== me || entry.label.text !== label.text || entry.label.extra !== label.extra) {
        if (label.kind === "player") { node.className = `voxel-name${me ? " is-me" : ""}`; node.textContent = label.text; }
        else {
          node.className = `voxel-target voxel-target--${label.kind}`;
          node.textContent = label.kind === "hidden" || label.kind === "sign" ? "" : "···";
          const description = label.kind === "hidden" ? `Ramasser : ${label.text}` : label.kind === "sign" ? `Lire le panneau : ${label.text}` : label.kind === "dragon" ? "Parler au dragon" : `Parler : ${ENVIRONMENT_LABELS[label.extra as EnvironmentKind] ?? label.text}`;
          node.setAttribute("aria-label", description);
          node.title = label.kind === "hidden" ? label.text : description;
          if (label.kind === "hidden") node.dataset.hiddenItem = label.id;
        }
      }
      const transform = `translate3d(${label.x.toFixed(3)}px,${label.y.toFixed(3)}px,0) translate(-50%,-100%)`;
      if (transform !== entry.transform) { node.style.transform = transform; entry.transform = transform; }
      entry.label = label; entry.me = me; entry.frame = this.frame;
    }
    for (const [id, entry] of this.entries) if (entry.frame !== this.frame) { entry.node.remove(); this.entries.delete(id); }
  }
  dispose() { this.host.removeEventListener("click", this.click); this.host.replaceChildren(); this.entries.clear(); }
}
