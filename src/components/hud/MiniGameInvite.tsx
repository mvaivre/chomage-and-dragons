"use client";
import { t as tr } from "@/lib/i18n/index";
import { useLocale } from "@/lib/i18n/react";
import { useEffect, useRef } from "react";
import type { ActionKind, MiniGameKind } from "@/lib/data/types";
import { MINI_GAME_BONUS } from "@/lib/config";
import { MINI_GAMES } from "@/lib/game/mini-games";
import { SCORE_UNITS } from "@/lib/game/scores";
import { STATIONS } from "@/lib/game/encounter-models";
import { EncounterEntrance, useEncounterEntrance } from "./EncounterEntrance";
import { EncounterArtwork } from "./EncounterArtwork";
import { useDialogKeyboard } from "./useDialogKeyboard";
/** The world object has already appeared along the walk. One choice opens its game. */
export function MiniGameInvite({ kind, action, record, onPlay, onPass }: {
    kind: MiniGameKind;
    action: ActionKind | "chest";
    record?: {
        score: number;
        holder: string;
    } | null;
    onPlay: () => void;
    onPass: () => void;
}) {
    const uiLocale = useLocale();
    const dialog = useRef<HTMLDialogElement>(null), play = useRef<HTMLButtonElement>(null);
    const copy = STATIONS[kind];
    const entrance = useEncounterEntrance();
    useDialogKeyboard(dialog, event => {
        if (event.repeat && ["Enter", " "].includes(event.key)) {
            event.preventDefault();
            return;
        }
        if (!entrance.ready && ["Enter", " "].includes(event.key)) {
            event.preventDefault();
            if (!event.repeat)
                entrance.finish();
        }
    });
    useEffect(() => {
        if (entrance.ready)
            play.current?.focus({ preventScroll: true });
    }, [entrance.ready]);
    useEffect(() => {
        const node = dialog.current, previous = document.activeElement as HTMLElement | null;
        node?.showModal();
        node?.focus();
        return () => { node?.close(); previous?.focus(); };
    }, []);
    return <dialog ref={dialog} className="mini-game-invite-stage roadside-invite" tabIndex={-1} data-entrance={entrance.ready ? "ready" : "reveal"} aria-label={tr(entrance.ready ? undefined : "Un objet apparaît sur le chemin", undefined, uiLocale)} aria-labelledby={entrance.ready ? "mini-game-invite-title" : undefined} onCancel={event => { event.preventDefault(); onPass(); }} onKeyDown={event => event.stopPropagation()}>
    {!entrance.ready ? <EncounterEntrance model={kind} onFinish={entrance.finish}/> : <>
    <div className="roadside-invite__scene" aria-hidden="true"><div className="roadside-invite__platform"/><EncounterArtwork model={kind}/></div>
    <section className="mini-game-invite">
      <div className="mini-game-invite__art" aria-hidden="true"><EncounterArtwork model={kind} className="mini-game-invite__picture"/></div>
      <div className="mini-game-invite__copy"><p className="mini-game-invite__kicker">{tr("Au bord du chemin · ", undefined, uiLocale)}{tr(MINI_GAMES[kind].title, undefined, uiLocale)}</p><h2 id="mini-game-invite-title">{tr(copy.title, undefined, uiLocale)}</h2><p className="roadside-invite__line">{tr(copy.line, undefined, uiLocale)}</p><small>{tr(action === "chest" ? "À gagner : un butin en plus" : `À gagner : +${MINI_GAME_BONUS[action]} pas bonus`, undefined, uiLocale)}</small>{record ? <small className="mini-game-invite__record">{tr("Record : ", undefined, uiLocale)}{record.score} {tr(SCORE_UNITS[kind], undefined, uiLocale)} · {record.holder}</small> : null}</div>
      <div className="mini-game-invite__actions"><button ref={play} type="button" className="mini-game-invite__play" onClick={onPlay}>{tr(copy.play, undefined, uiLocale)}</button><button type="button" className="mini-game-invite__pass" onClick={onPass}>{tr("Continuer mon chemin", undefined, uiLocale)}</button></div>
    </section></>}
  </dialog>;
}
