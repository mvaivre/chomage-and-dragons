"use client";

import { useEffect, useRef } from "react";
import type { ActionKind, MiniGameKind } from "@/lib/data/types";
import { MINI_GAME_BONUS } from "@/lib/config";
import { MINI_GAMES } from "@/lib/game/mini-games";
import { SCORE_UNITS } from "@/lib/game/scores";
import { STATIONS } from "@/lib/game/encounter-models";
import { sfx } from "@/lib/client/sound";
import { EncounterArtwork } from "./EncounterArtwork";
import { useDialogKeyboard } from "./useDialogKeyboard";

/** The world object has already appeared along the walk. One choice opens its game. */
export function MiniGameInvite({ kind, action, record, onPlay, onPass }: {
  kind: MiniGameKind; action: ActionKind | "chest";
  record?: { score: number; holder: string } | null;
  onPlay: () => void; onPass: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null), play = useRef<HTMLButtonElement>(null);
  const copy = STATIONS[kind];
  useDialogKeyboard(dialog);
  useEffect(() => {
    const node = dialog.current, previous = document.activeElement as HTMLElement | null;
    node?.showModal(); sfx.invite(); play.current?.focus();
    return () => { node?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className="mini-game-invite-stage roadside-invite" aria-labelledby="mini-game-invite-title" onCancel={event => { event.preventDefault(); onPass(); }} onKeyDown={event => event.stopPropagation()}>
    <section className="mini-game-invite">
      <div className="mini-game-invite__art" aria-hidden="true"><EncounterArtwork model={kind} className="mini-game-invite__picture" /></div>
      <div className="mini-game-invite__copy"><p className="mini-game-invite__kicker">Au bord du chemin · {MINI_GAMES[kind].title}</p><h2 id="mini-game-invite-title">{copy.title}</h2><p className="roadside-invite__line">{copy.line}</p><small>{action === "chest" ? "À gagner : un butin en plus" : `À gagner : +${MINI_GAME_BONUS[action]} pas bonus`}</small>{record ? <small className="mini-game-invite__record">Record : {record.score} {SCORE_UNITS[kind]} · {record.holder}</small> : null}</div>
      <div className="mini-game-invite__actions"><button ref={play} type="button" className="mini-game-invite__play" onClick={onPlay}>{copy.play}</button><button type="button" className="mini-game-invite__pass" onClick={onPass}>Continuer mon chemin</button></div>
    </section>
  </dialog>;
}
