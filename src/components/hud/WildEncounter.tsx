"use client";
import { t as tr } from "@/lib/i18n/index";
import { useLocale } from "@/lib/i18n/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { EncounterMove, WildEncounter as Encounter } from "@/lib/data/types";
import { activeEncounter, captureHint, incomingHeavy, monsterName, MONSTERS } from "@/lib/game/encounters";
import { battlePlayback, type BattlePhase, type BattlePlayback } from "@/lib/game/battle-presentation";
import { EncounterEntrance, useEncounterEntrance } from "./EncounterEntrance";
import { UiIcon } from "./UiIcon";
import { EncounterArtwork } from "./EncounterArtwork";
import { CharacterPortrait } from "./CharacterPortrait";
import { characterById } from "@/lib/game/characters";
import { useDialogKeyboard } from "./useDialogKeyboard";
import { sfx } from "@/lib/client/sound";
export function WildEncounter({ encounter: e, name, characterId, onMove, onDone, onCollection }: {
    encounter: Encounter;
    name: string;
    characterId: string;
    onMove: (move: EncounterMove) => Encounter | null;
    onDone: () => void;
    onCollection: () => void;
}) {
    const uiLocale = useLocale();
    const dialog = useRef<HTMLDialogElement>(null);
    const primary = useRef<HTMLButtonElement>(null);
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
    const locked = useRef(false);
    const [phase, setPhase] = useState<BattlePhase>("ready");
    const [playback, setPlayback] = useState<BattlePlayback | null>(null);
    const busy = phase !== "ready";
    const offered = e.status === "offered", finished = !activeEncounter(e), captured = e.status === "captured";
    const title = tr(monsterName(e), undefined, uiLocale);
    const entrance = useEncounterEntrance(offered, true);
    const enemyActing = phase === "enemy-windup" || phase === "enemy-hit";
    const energy = playback && phase !== "enemy-hit" && busy ? playback.playerEnergy : e.energy;
    const hp = playback && busy ? playback.after.hp : e.hp;
    const animation = phase === "player" ? playback?.move : undefined;
    useEffect(() => {
        if (!busy && captured)
            sfx.fanfare();
        else if (!busy && e.status === "lost")
            sfx.sad();
    }, [busy, captured, e.status]);
    const close = () => {
        if (activeEncounter(e))
            onMove("leave");
        onDone();
    };
    useDialogKeyboard(dialog, event => {
        if (event.repeat && ["Enter", " "].includes(event.key)) {
            event.preventDefault();
            return;
        }
        if (!entrance.ready && ["Enter", " "].includes(event.key)) {
            event.preventDefault();
            entrance.finish();
        }
    });
    useEffect(() => {
        const node = dialog.current, previous = document.activeElement as HTMLElement | null;
        node?.showModal();
        if (primary.current)
            primary.current.focus();
        else
            node?.focus();
        return () => { node?.close(); timers.current.forEach(clearTimeout); previous?.focus(); };
    }, []);
    useLayoutEffect(() => {
        if (entrance.ready && !busy)
            primary.current?.focus({ preventScroll: true });
    }, [e.status, busy, entrance.ready]);
    const move = (value: EncounterMove) => {
        if (locked.current)
            return;
        if (value === "challenge" || value === "leave") {
            if (value === "challenge")
                sfx.battleStart();
            onMove(value);
            return;
        }
        // Persist the entire turn first, then show the two sides acting separately.
        const result = onMove(value);
        if (!result)
            return;
        const next = battlePlayback(e, result, value);
        locked.current = true;
        setPlayback(next);
        setPhase("player");
        sfx.battleMove(value);
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const playerMs = reduced ? 180 : value === "capture" ? 1200 : 650;
        const windupMs = reduced ? 200 : 450;
        const hitMs = reduced ? 220 : 550;
        const later = (ms: number, run: () => void) => timers.current.push(setTimeout(run, ms));
        if (next.reply) {
            later(playerMs, () => { setPhase("enemy-windup"); sfx.enemyAttack(next.heavy); });
            later(playerMs + windupMs, () => { setPhase("enemy-hit"); sfx.hit(); });
        }
        later(playerMs + (next.reply ? windupMs + hitMs : 0), () => { setPhase("ready"); locked.current = false; timers.current = []; });
    };
    const line = offered ? MONSTERS[e.monster].intro : phase === "player" ? playback!.playerLine : enemyActing ? `${tr(MONSTERS[e.monster].attack, undefined, uiLocale)} !` : captured ? `${title} capturé !` : e.status === "lost" ? "Pause ! Tes pas sont conservés." : playback ? `−${playback.enemyDamage} énergie. À toi !` : "À toi de jouer !";
    const cue = offered ? "Rencontre" : enemyActing ? "Riposte adverse" : busy ? "Ton action" : finished ? captured ? "Capturé" : "Fin du combat" : "Ton tour";
    const hint = hp <= 65 ? captureHint(hp).split(" · ")[1] : "Affaiblis-le pour capturer";
    return <dialog ref={dialog} className="wild-encounter" tabIndex={-1} data-entrance={entrance.ready ? "ready" : "reveal"} data-phase={phase} aria-label={tr(entrance.ready ? undefined : "Une rencontre sauvage apparaît", undefined, uiLocale)} aria-labelledby={entrance.ready ? "wild-title" : undefined} aria-describedby={entrance.ready ? "wild-message" : undefined} data-status={e.status} data-animation={animation} data-heavy={playback?.heavy || undefined} data-turn={e.turn} onCancel={event => { event.preventDefault(); close(); }} onKeyDown={event => event.stopPropagation()}>
    {!entrance.ready ? <EncounterEntrance model={e.monster} rare={e.rare} wild onFinish={entrance.finish}/> : <>
      <div className="wild-encounter__heading"><span>{tr("Combat sauvage ", undefined, uiLocale)}{tr(e.rare ? "· Variante rare ✦" : "", undefined, uiLocale)}</span><button type="button" onClick={close} aria-label={tr("Quitter la rencontre", undefined, uiLocale)}>×</button></div>
      <div className="wild-encounter__field">
        <section className="wild-fighter wild-fighter--hero" aria-label={tr("Toi : {0}", [name], uiLocale)} data-target="hero">
          <header className="wild-fighter__identity"><span>{tr("TOI", undefined, uiLocale)}</span><strong>{name}</strong></header>
          <div className="wild-fighter__figure">
            <div className="wild-fighter__platform"/>
            <div className="wild-encounter__hero"><CharacterPortrait character={characterById(characterId)}/></div>
            {phase === "enemy-hit" ? <><span className="wild-fighter__impact" aria-hidden="true">✦</span><b className="wild-fighter__damage" aria-hidden="true">−{playback!.enemyDamage}</b></> : null}
            {animation === "rest" && playback?.recovered ? <b className="wild-fighter__heal" aria-hidden="true">+{playback.recovered}</b> : null}
          </div>
          <div className="wild-fighter__stats"><label>{tr("Énergie ", undefined, uiLocale)}<span data-energy={energy}>{energy}/100</span></label><meter aria-label={tr("Ton énergie : {0} sur 100", [energy], uiLocale)} min="0" max="100" value={energy}>{energy}/100</meter></div>
        </section>
        <section className="wild-fighter wild-fighter--enemy" aria-label={tr("Adversaire : {0}", [title], uiLocale)} data-target="enemy">
          <header className="wild-fighter__identity"><span>{tr("ADVERSAIRE", undefined, uiLocale)}</span><h2 id="wild-title">{tr(title, undefined, uiLocale)}</h2></header>
          <div className="wild-fighter__figure">
            <div className="wild-fighter__platform"/>
            <EncounterArtwork model={e.monster} rare={e.rare} className="wild-encounter__enemy"/>
            {animation === "argue" || animation === "polite" ? <><span className="wild-fighter__impact" aria-hidden="true">✦</span><b className="wild-fighter__damage" aria-hidden="true">−{playback!.playerDamage}</b></> : null}
            {animation === "capture" || captured ? <div className="wild-encounter__ball"><EncounterArtwork model="ball"/></div> : null}
          </div>
          <div className="wild-fighter__stats"><label>{tr("Résistance ", undefined, uiLocale)}<span>{hp}/100</span></label><meter aria-label={tr("Résistance adverse : {0} sur 100", [hp], uiLocale)} min="0" max="100" value={hp}>{hp}/100</meter></div>
        </section>
        {phase === "enemy-windup" ? <div className="wild-encounter__projectile" aria-hidden="true">✦</div> : null}
      </div>
      <div className="wild-encounter__message" role="status" aria-live="polite"><span className="wild-encounter__turn-label">{tr(cue, undefined, uiLocale)}</span><p id="wild-message">{tr(line, undefined, uiLocale)}</p></div>
      <div className="wild-encounter__dialogue">
        {offered ? <div className="wild-encounter__choices"><button ref={primary} type="button" onClick={() => move("challenge")}>{tr("Relever le défi", undefined, uiLocale)}</button><button type="button" onClick={close}>{tr("Continuer mon chemin", undefined, uiLocale)}</button></div> : finished && !busy ? <div className="wild-encounter__choices"><button ref={primary} type="button" onClick={onDone}>{tr("Reprendre la route", undefined, uiLocale)}</button>{captured ? <button type="button" onClick={onCollection}>{tr("Voir ma collection", undefined, uiLocale)}</button> : null}</div> : <div className="wild-encounter__commands" aria-label={tr("Actions de combat", undefined, uiLocale)} aria-busy={busy}>
          <button ref={primary} type="button" data-move="argue" disabled={busy} onClick={() => move("argue")}><UiIcon name="sword"/><span>{tr("Argument béton", undefined, uiLocale)}<small>{tr("Attaquer · −28", undefined, uiLocale)}</small></span></button>
          <button type="button" data-move="polite" disabled={busy} onClick={() => move("polite")}><UiIcon name="letter"/><span>{tr("Relance polie", undefined, uiLocale)}<small>{tr("−18 et se protéger", undefined, uiLocale)}</small></span></button>
          <button type="button" data-move="rest" disabled={busy} onClick={() => move("rest")}><UiIcon name="mug"/><span>{tr("Souffler", undefined, uiLocale)}<small>{tr("+30 énergie · protection", undefined, uiLocale)}</small></span></button>
          <button type="button" data-move="capture" disabled={busy || e.balls === 0} onClick={() => move("capture")}><EncounterArtwork model="ball"/><span>{tr("Chômageball", undefined, uiLocale)}<small>{tr(hint, undefined, uiLocale)} · {e.balls}{tr(" restantes", undefined, uiLocale)}</small></span></button>
          {!busy && incomingHeavy(e) ? <span className="wild-encounter__warning">{tr("Grosse attaque au prochain tour.", undefined, uiLocale)}</span> : null}
          <button type="button" data-move="leave" disabled={busy} onClick={close}>{tr("Continuer mon chemin ", undefined, uiLocale)}<span aria-hidden="true">›</span></button>
        </div>}
      </div>
    </>}
  </dialog>;
}
