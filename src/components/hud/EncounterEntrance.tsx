"use client";

import { useEffect, useState } from "react";
import type { EncounterModel } from "@/lib/game/encounter-models";
import { EncounterArtwork } from "./EncounterArtwork";
import { sfx } from "@/lib/client/sound";

/** One modal, two beats: reveal the object, then pop in its choices. No extra click. */
export function useEncounterEntrance(animate = true, wild = false) {
  const [ready, setReady] = useState(!animate);
  useEffect(() => {
    if (ready) {
      const sound = window.setTimeout(() => sfx.encounterPrompt(), 0);
      return () => window.clearTimeout(sound);
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sound = window.setTimeout(() => sfx.encounterAppear(wild, reduced), 0);
    const timer = window.setTimeout(() => setReady(true), reduced ? 300 : 1450);
    return () => { window.clearTimeout(sound); window.clearTimeout(timer); };
  }, [ready, wild]);
  return { ready, finish: () => setReady(true) };
}

export function EncounterEntrance({ model, rare = false, wild = false, onFinish }: {
  model: EncounterModel; rare?: boolean; wild?: boolean; onFinish: () => void;
}) {
  return <div className="encounter-entrance" data-wild={wild} data-rare={rare}>
    <div className="encounter-entrance__rays" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ rotate: `${i * 30}deg` }} />)}</div>
    <span className="encounter-entrance__eyebrow">{wild ? "Rencontre sauvage" : "Au bord du chemin"}</span>
    <span className="encounter-entrance__surprise" aria-hidden="true">!</span>
    <div className="encounter-entrance__halo" aria-hidden="true" />
    <div className="encounter-entrance__shadow" aria-hidden="true" />
    <EncounterArtwork model={model} rare={rare} className="encounter-entrance__object" />
    <div className="encounter-entrance__sparks" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ rotate: `${i * 45}deg` }} />)}</div>
    <p className="encounter-entrance__caption">{wild ? "Ça bouge dans les dossiers…" : "Tiens… qu’est-ce que c’est ?"}</p>
    <button type="button" className="encounter-entrance__skip" onClick={onFinish}>Passer l’animation <span aria-hidden="true">›</span></button>
  </div>;
}
