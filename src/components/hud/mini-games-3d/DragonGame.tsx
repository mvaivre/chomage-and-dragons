"use client";
import { t as tr } from "@/lib/i18n/index";
import { useLocale } from "@/lib/i18n/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { VoxelDisplay } from "@/components/voxel/Display";
import { seedFrom } from "@/lib/game/random";
import { punchlineFor } from "@/lib/game/punchlines";
import { advanceDragonRun, createDragonRun, dragonScore, DRAGON_GAME, steerDragonRun, type DragonRun } from "@/lib/game/dragon-flight";
import { sfx } from "@/lib/client/sound";
import { MiniGameShell, ScoreLine, type MiniGameProps } from "../mini-games/MiniGameShell";
export function DragonGame({ seedId, onResolve, onDone, practice, record, best }: MiniGameProps) {
    const uiLocale = useLocale();
    // The live run is mutated by the loop; `view` is the snapshot React draws.
    const [course] = useState(() => createDragonRun(seedFrom(seedId)));
    const run = useRef<DragonRun>(course);
    const [view, setView] = useState(() => createDragonRun(seedFrom(seedId)));
    const [started, setStarted] = useState(false);
    const resolved = useRef(false);
    const finished = view.status !== "running";
    const settle = useCallback(() => {
        if (resolved.current)
            return;
        resolved.current = true;
        onResolve(run.current.status === "won" ? "won" : "lost", dragonScore(run.current));
        (run.current.status === "won" ? sfx.win : sfx.sad)();
    }, [onResolve]);
    useEffect(() => {
        if (!started || finished)
            return;
        let raf = 0, previous = performance.now(), painted = previous;
        const tick = (now: number) => {
            const beforeLives = run.current.lives, beforeGold = run.current.gold;
            if (!document.hidden)
                advanceDragonRun(run.current, (now - previous) / 1000);
            previous = now;
            if (beforeLives > run.current.lives)
                sfx.hit();
            if (beforeGold < run.current.gold)
                sfx.chime();
            if (now - painted > 32 || run.current.status !== "running") {
                painted = now;
                setView({ ...run.current, objects: run.current.objects.map(o => ({ ...o })) });
            }
            if (run.current.status !== "running") {
                settle();
                return;
            }
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [started, finished, settle]);
    const steer = (direction: number) => {
        if (!started || finished)
            return;
        steerDragonRun(run.current, direction);
        setView({ ...run.current, objects: run.current.objects.map(o => ({ ...o })) });
    };
    const leave = () => {
        if (!resolved.current) {
            resolved.current = true;
            onResolve("skipped");
        }
        onDone();
    };
    const won = view.status === "won";
    return <MiniGameShell kind="dragon" eyebrow={tr(practice ? "Entraînement" : "Défi", undefined, uiLocale)} title={tr("La part du dragon", undefined, uiLocale)} instructions={tr(finished ? won ? "Butin volé au dragon." : punchlineFor(`dragon:${seedId}`)
            : `Attrape ${DRAGON_GAME.required} pièces en évitant les flammes pendant ${DRAGON_GAME.duration} secondes`, undefined, uiLocale)} focusKey={started ? finished ? "done" : "play" : "ready"} onLeave={leave} onKeyDown={event => {
            if (event.key !== "ArrowUp" && event.key !== "ArrowDown")
                return;
            event.preventDefault();
            steer(event.key === "ArrowUp" ? -1 : 1);
        }} hud={<><span>{tr("Butin ", undefined, uiLocale)}<b>{view.gold}/{DRAGON_GAME.required}</b></span><span>{tr("Armure ", undefined, uiLocale)}<b>{tr("◆".repeat(Math.max(0, view.lives)), undefined, uiLocale)}{tr("◇".repeat(DRAGON_GAME.lives - Math.max(0, view.lives)), undefined, uiLocale)}</b></span><span><b>{Math.max(0, Math.ceil(DRAGON_GAME.duration - view.t))}{tr(" s", undefined, uiLocale)}</b></span></>} status={finished ? <><strong>{tr(won ? practice ? "Dragon battu" : "+2 pas bonus" : "Raté.", undefined, uiLocale)}</strong><ScoreLine score={dragonScore(view)} unit="" record={record} best={best} practice={practice}/></> : <span>{tr("↑ ↓ ou boutons : changer de hauteur", undefined, uiLocale)}</span>} primary={{ inArena: !started && !finished, hidden: started && !finished, label: finished ? "Continuer le voyage" : started ? "Le dragon attaque…" : "Voler le butin", disabled: started && !finished, onClick: () => finished ? onDone() : setStarted(true) }} skip={!finished ? { label: "Passer", onClick: leave } : null}>
    <div className="mini-game__arena dragon-arena" data-running={started && !finished} data-lane={view.lane} aria-label={tr("Position {0} sur 3", [view.lane + 1], uiLocale)}>
      <VoxelDisplay draw={(ctx, viewport) => {
            ctx.background();
            for (let lane = 0; lane < 3; lane++)
                ctx.block(lane === view.lane ? 0x466e5a : 0x344e45, 180, 55 + lane * 65, 340, 48, 5, -5);
            ctx.dragon(290, 88, .7, viewport.reducedMotion ? 0 : viewport.now);
            ctx.person(64, 55 + view.lane * 65, .75, 0x9b87b1);
            for (const object of view.objects) {
                const x = object.x * 3.6, y = 55 + object.lane * 65;
                if (object.kind === "gold")
                    ctx.coin(x, y, 9);
                else
                    for (let i = 0; i < 4; i++)
                        ctx.block(0xeaad65, x + i * 3, y - i * 3, 8, 10, 8, 9, 0, true);
            }
        }}/>
      {finished ? <span className="mini-game__stamp">{tr(won ? "BUTIN VOLÉ" : "BIEN CUIT", undefined, uiLocale)}</span> : null}
    </div>
    {/* At a lane's end the button stays focusable: disabling it under the keyboard would drop focus out of the game. */}
    <div className="dragon-controls"><button type="button" disabled={!started || finished} aria-disabled={view.lane === 0} onClick={() => steer(-1)}>{tr("↑ Monter", undefined, uiLocale)}</button><button type="button" disabled={!started || finished} aria-disabled={view.lane === 2} onClick={() => steer(1)}>{tr("↓ Descendre", undefined, uiLocale)}</button></div>
  </MiniGameShell>;
}
