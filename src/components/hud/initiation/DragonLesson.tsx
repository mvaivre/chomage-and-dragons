"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  advanceDragonLesson, createDragonLesson, DRAGON_RITE_LANES,
  steerDragonLesson, type DragonLessonRun,
} from "@/lib/game/initiation";
import { VoxelPortrait } from "@/components/voxel/PortraitStudio";
import { useDialogKeyboard } from "../useDialogKeyboard";

const laneName = ["haut", "milieu", "bas"];
export function DragonLesson({ characterId, complete, onComplete }: { characterId: string; complete: boolean; onComplete: () => void }) {
  const lesson = useRef<HTMLElement>(null);
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
  useDialogKeyboard(lesson, event => {
    if (!["ArrowUp", "ArrowDown", "z", "Z", "w", "W", "s", "S"].includes(event.key)) return;
    event.preventDefault();
    steer(["ArrowUp", "z", "Z", "w", "W"].includes(event.key) ? -1 : 1);
  });
  return <section ref={lesson} className="initiation-lesson initiation-lesson--dragon" aria-label="Rite du dragon">
    <p className="initiation-lead">Traverse les quatre anneaux avec les flèches ↑ et ↓</p>
    <div className="initiation-flight" data-lane={view.lane} data-flying={flightActive && !paused} role="group" aria-label={done ? "Les quatre anneaux ont été traversés." : `Dragon en ${laneName[view.lane]}, anneau en ${laneName[ringLane]}. ${view.collected} sur quatre traversés.`}>
      <VoxelPortrait scene="flight" characterId={characterId} animated={flightActive && !paused} lane={view.lane} ringLane={ringLane} ringX={view.ringX} done={done} label="Ton personnage à dos de dragon" />
      <span className="initiation-flight__seal">{done ? "PERMIS DE DRAGON" : "ÉCOLE DE VOL"}</span>
      {!started && !done ? <button className="initiation-primary initiation-launch" type="button" onClick={() => { run.current.status = "flying"; setStarted(true); }}>Décoller</button> : null}
      {paused && !done ? <span className="initiation-flight__pause">Vol en pause</span> : null}
    </div>
    <div className="initiation-flight__readout" aria-live="polite" aria-atomic="true">
      <span className="initiation-ring-count" aria-label={`${done ? 4 : view.collected} anneaux sur quatre`}>{DRAGON_RITE_LANES.map((_, i) => <i key={i} data-collected={done || i < view.collected} aria-hidden />)}</span>
      <span>{done ? "Épreuve réussie" : !started ? "Prêt à décoller" : paused ? "En pause" : view.misses ? `Vise en ${laneName[ringLane]}` : `Vise en ${laneName[ringLane]}`}</span>
    </div>
    {started && !done ? <div className="initiation-flight-controls">
      <button ref={upControl} type="button" onClick={() => steer(-1)} aria-label="Monter le dragon" aria-disabled={paused || view.lane === 0}>↑ Monter</button>
      <button type="button" className="initiation-flight-controls__pause" onClick={() => setPaused(value => !value)} aria-label={paused ? "Reprendre le vol" : "Mettre le vol en pause"}>{paused ? "▶" : "Ⅱ"}</button>
      <button type="button" onClick={() => steer(1)} aria-label="Descendre le dragon" aria-disabled={paused || view.lane === 2}>↓ Descendre</button>
    </div> : null}
  </section>;
}
