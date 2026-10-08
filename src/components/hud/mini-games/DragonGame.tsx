"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { characterArt } from "@/lib/game/characters";
import { seedFrom } from "@/lib/game/random";
import { advanceDragonRun, createDragonRun, dragonScore, DRAGON_GAME, steerDragonRun, type DragonRun } from "@/lib/game/dragon-flight";
import { sfx } from "@/lib/client/sound";
import { MiniGameShell, ScoreLine, type MiniGameProps } from "./MiniGameShell";

export function DragonGame({ seedId, onResolve, onDone, practice, record, best, characterId = "chevalier" }: MiniGameProps) {
  // The live run is mutated by the loop; `view` is the snapshot React draws.
  const [course] = useState(() => createDragonRun(seedFrom(seedId)));
  const run = useRef<DragonRun>(course);
  const [view, setView] = useState(() => createDragonRun(seedFrom(seedId)));
  const [started, setStarted] = useState(false);
  const resolved = useRef(false);
  const finished = view.status !== "running";
  const settle = useCallback(() => {
    if (resolved.current) return;
    resolved.current = true;
    onResolve(run.current.status === "won" ? "won" : "lost", dragonScore(run.current));
    (run.current.status === "won" ? sfx.win : sfx.sad)();
  }, [onResolve]);
  useEffect(() => {
    if (!started || finished) return;
    let raf = 0, previous = performance.now(), painted = previous;
    const tick = (now: number) => {
      const beforeLives = run.current.lives, beforeGold = run.current.gold;
      if (!document.hidden) advanceDragonRun(run.current, (now - previous) / 1000);
      previous = now;
      if (beforeLives > run.current.lives) sfx.hit();
      if (beforeGold < run.current.gold) sfx.chime();
      if (now - painted > 32 || run.current.status !== "running") {
        painted = now;
        setView({ ...run.current, objects: run.current.objects.map(o => ({ ...o })) });
      }
      if (run.current.status !== "running") { settle(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, finished, settle]);
  const steer = (direction: number) => {
    if (!started || finished) return;
    steerDragonRun(run.current, direction);
    setView({ ...run.current, objects: run.current.objects.map(o => ({ ...o })) });
  };
  const leave = () => { if (!resolved.current) { resolved.current = true; onResolve("skipped"); } onDone(); };
  const won = view.status === "won";
  return <MiniGameShell kind="dragon" eyebrow={practice ? "Rencontre · entraînement" : "Le dragon garde le courrier"} title="La part du dragon"
    instructions={finished ? won ? "Butin récupéré. Le dragon peut aller se faire cuire un œuf." : "Le dragon garde le butin. Tes pas restent acquis."
      : "Monte ou descends pour esquiver les flammes. Attrape 5 pièces et tiens 16 secondes. Flèches ↑ ↓ ou boutons."}
    focusKey={started ? finished ? "done" : "play" : "ready"}
    onLeave={leave} onKeyDown={event => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault(); steer(event.key === "ArrowUp" ? -1 : 1);
    }}
    hud={<><span>Butin <b>{view.gold}/{DRAGON_GAME.required}</b></span><span>Armure <b>{"◆".repeat(Math.max(0, view.lives))}{"◇".repeat(DRAGON_GAME.lives - Math.max(0, view.lives))}</b></span><span><b>{Math.max(0, Math.ceil(DRAGON_GAME.duration - view.t))} s</b></span></>}
    status={finished ? <><strong>{won ? practice ? "Dragon battu" : "+2 pas bonus" : "Roussi·e, mais vivant·e"}</strong><ScoreLine score={dragonScore(view)} unit="" record={record} best={best} practice={practice} /></> : <span>{started ? "Les flammes arrivent de la droite." : "Aucun pas perdu si tu rates."}</span>}
    primary={{ label: finished ? "Continuer le voyage" : started ? "Le dragon attaque…" : "Voler le butin", disabled: started && !finished, onClick: () => finished ? onDone() : setStarted(true) }}
    skip={!finished ? { label: "Passer", onClick: leave } : null}>
    <div className="mini-game__arena dragon-arena" data-running={started && !finished}>
      {[0, 1, 2].map(lane => <div key={lane} className="dragon-arena__lane" style={{ top: `${lane * 27 + 15}%` }} />)}
      <div className="dragon-sprite dragon-arena__dragon" style={{ backgroundPosition: started && !finished ? "66.666% 0%" : "100% 100%" }} aria-hidden />
      <div className="dragon-arena__rider" style={{ top: `${view.lane * 27 + 15}%` }} aria-label={`Position ${view.lane + 1} sur 3`}><span style={{ backgroundImage: `url(${characterArt(characterId)})` }} /></div>
      {view.objects.map(object => <div key={object.id} className={`dragon-arena__${object.kind}`} style={{ left: `${object.x}%`, top: `${object.lane * 27 + 15}%` }} aria-hidden>{object.kind === "gold" ? "◆" : ""}</div>)}
      {finished ? <span className="mini-game__stamp">{won ? "BUTIN VOLÉ" : "BIEN CUIT"}</span> : null}
    </div>
    {/* At a lane's end the button stays focusable: disabling it under the keyboard would drop focus out of the game. */}
    <div className="dragon-controls"><button type="button" disabled={!started || finished} aria-disabled={view.lane === 0} onClick={() => steer(-1)}>↑ Monter</button><button type="button" disabled={!started || finished} aria-disabled={view.lane === 2} onClick={() => steer(1)}>↓ Descendre</button></div>
  </MiniGameShell>;
}
