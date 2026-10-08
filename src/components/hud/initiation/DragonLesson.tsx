"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  advanceDragonLesson, createDragonLesson, DRAGON_RITE_LANES,
  steerDragonLesson, type DragonLessonRun,
} from "@/lib/game/initiation";

const laneName = ["haut", "milieu", "bas"];
export function DragonLesson({ complete, onComplete }: { complete: boolean; onComplete: () => void }) {
  const [initial] = useState(createDragonLesson);
  const run = useRef<DragonLessonRun>(initial);
  const [view, setView] = useState(initial);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const upControl = useRef<HTMLButtonElement>(null);
  const done = complete || view.status === "done";
  const notifyComplete = useRef(false);
  useEffect(() => { if (started) upControl.current?.focus({ preventScroll: true }); }, [started]);
  useEffect(() => {
    if (!started || done || paused) return;
    let raf = 0, previous = performance.now(), painted = previous;
    const tick = (now: number) => {
      if (!document.hidden) advanceDragonLesson(run.current, (now - previous) / 1000);
      previous = now;
      if (now - painted > 32 || run.current.status === "done") {
        painted = now;
        setView({ ...run.current });
      }
      if (run.current.status === "done") {
        if (!notifyComplete.current) { notifyComplete.current = true; onComplete(); }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, done, paused, onComplete]);
  const steer = useCallback((direction: number) => {
    if (paused) return;
    steerDragonLesson(run.current, direction);
    setView({ ...run.current });
  }, [paused]);
  const ringLane = DRAGON_RITE_LANES[Math.min(view.collected, DRAGON_RITE_LANES.length - 1)];
  const flightActive = started && !done;
  return <section className="initiation-lesson initiation-lesson--dragon" aria-label="Rite du dragon" onKeyDown={event => {
    if (!["ArrowUp", "ArrowDown", "z", "Z", "w", "W", "s", "S"].includes(event.key)) return;
    event.preventDefault();
    steer(["ArrowUp", "z", "Z", "w", "W"].includes(event.key) ? -1 : 1);
  }}>
    <p className="initiation-lead">Traverse les quatre anneaux. Le dragon suit tes ordres. Enfin, à peu près.</p>
    <div className="initiation-flight" data-flying={flightActive && !paused} role="img" aria-label={done ? "Les quatre anneaux ont été traversés." : `Dragon en ${laneName[view.lane]}, anneau en ${laneName[ringLane]}. ${view.collected} sur quatre traversés.`}>
      <div className="initiation-flight__moon" />
      <div className="initiation-flight__mountains" />
      {[0, 1, 2].map(lane => <div key={lane} className="initiation-flight__lane" style={{ top: `${lane * 22 + 28}%` }} />)}
      {!done ? <div className="initiation-flight__ring" style={{ left: `${view.ringX}%`, top: `${ringLane * 22 + 28}%` }} /> : null}
      <div className="initiation-flight__rider" style={{ top: `${(done ? 1 : view.lane) * 22 + 28}%` }} aria-hidden>
        <div className="initiation-flight__dragon" />
        <div className="initiation-flight__knight" />
      </div>
      <span className="initiation-flight__seal">{done ? "PERMIS DE DRAGON" : "ÉCOLE DE VOL · SANS ASSURANCE"}</span>
      {paused && !done ? <span className="initiation-flight__pause">Vol en pause</span> : null}
    </div>
    <div className="initiation-flight__readout" aria-live="polite" aria-atomic="true">
      <span className="initiation-ring-count" aria-label={`${done ? 4 : view.collected} anneaux sur quatre`}>{DRAGON_RITE_LANES.map((_, i) => <i key={i} data-collected={done || i < view.collected} aria-hidden />)}</span>
      <span>{done ? "Le dragon t’adopte. Son service RH, moins." : !started ? "Prêt·e à quitter le plancher des gobelins ?" : paused ? "Prends ton temps. Le ciel attend." : view.misses ? `Anneau en ${laneName[ringLane]}. Raté ? Il revient, sans pénalité.` : `Vise l’anneau en ${laneName[ringLane]}.`}</span>
    </div>
    {!started && !done ? <button className="initiation-primary" type="button" onClick={() => { run.current.status = "flying"; setStarted(true); }}>Décoller</button> : !done ? <div className="initiation-flight-controls">
      <button ref={upControl} type="button" onClick={() => steer(-1)} aria-label="Monter le dragon" aria-disabled={paused || view.lane === 0}>↑ Monter</button>
      <button type="button" className="initiation-flight-controls__pause" onClick={() => setPaused(value => !value)} aria-label={paused ? "Reprendre le vol" : "Mettre le vol en pause"}>{paused ? "▶" : "Ⅱ"}</button>
      <button type="button" onClick={() => steer(1)} aria-label="Descendre le dragon" aria-disabled={paused || view.lane === 2}>↓ Descendre</button>
    </div> : null}
    {!done ? <p className="initiation-hint">Flèches ↑ ↓ ou boutons · Aucun chrono, aucune vie perdue.</p> : null}
  </section>;
}
