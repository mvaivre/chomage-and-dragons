"use client";

import { useEffect, useRef } from "react";
import type { ActionKind, MiniGameKind } from "@/lib/data/types";
import { JOURNEY_STEPS, MINI_GAME_BONUS } from "@/lib/config";
import { MINI_GAMES } from "@/lib/game/mini-games";
import { SCORE_UNITS } from "@/lib/game/scores";
import { sfx } from "@/lib/client/sound";
import { ActionArtwork, ChestArtwork } from "./Artwork";

/** What winning brings: a big seal and its caption. */
function stake(action: ActionKind | "chest"): { seal: string; line: string } {
  if (action === "chest") return { seal: "+1", line: "butin en plus" };
  if (action === "candidature") return { seal: "×2", line: `+${JOURNEY_STEPS.candidature + MINI_GAME_BONUS.candidature} pas au lieu de ${JOURNEY_STEPS.candidature}` };
  if (action === "entretien") return { seal: `+${MINI_GAME_BONUS.entretien}`, line: `${JOURNEY_STEPS.entretien + MINI_GAME_BONUS.entretien} pas au lieu de ${JOURNEY_STEPS.entretien}` };
  return { seal: `+${MINI_GAME_BONUS[action]}`, line: "pas bonus" };
}

/**
 * The challenge arrives once the action's moment has played out, as a card:
 * the moment is never cut short, and the player chooses when to dive in.
 * Enter or Space plays, Escape passes.
 */
export function MiniGameInvite({ kind, action, record, onPlay, onPass }: {
  kind: MiniGameKind;
  action: ActionKind | "chest";
  record?: { score: number; holder: string } | null;
  onPlay: () => void;
  onPass: () => void;
}) {
  const play = useRef<HTMLButtonElement>(null);
  const copy = MINI_GAMES[kind];
  const pass = useRef(onPass);
  useEffect(() => { pass.current = onPass; });
  useEffect(() => {
    sfx.invite();
    play.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); pass.current(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const reward = stake(action);
  return <div className="mini-game-invite-stage">
    <span className="mini-game-invite__rays" aria-hidden />
    <section className="mini-game-invite" role="dialog" aria-modal="false" aria-labelledby="mini-game-invite-title">
    <span className="mini-game-invite__ribbon" aria-hidden>{action === "chest" ? "Double fond !" : "Défi !"}</span>
    <div className="mini-game-invite__art" aria-hidden>
      {action === "chest" ? <ChestArtwork className="mini-game-invite__picture" /> : <ActionArtwork kind={action} className="mini-game-invite__picture" />}
      <span className="mini-game-invite__seal"><b>{reward.seal}</b></span>
    </div>
    <div className="mini-game-invite__copy">
      <p className="mini-game-invite__kicker">{copy.misery}</p>
      <h2 id="mini-game-invite-title">{copy.title}</h2>
      <p className="mini-game-invite__stake">{reward.line}</p>
      {record ? <p className="mini-game-invite__record">Record : {record.score} {SCORE_UNITS[kind]} · {record.holder}</p> : null}
    </div>
    <div className="mini-game-invite__actions">
      <button ref={play} type="button" className="mini-game-invite__play" onClick={onPlay}>Relever le défi</button>
      <button type="button" className="mini-game-invite__pass" onClick={onPass}>Passer</button>
    </div>
    </section>
  </div>;
}
