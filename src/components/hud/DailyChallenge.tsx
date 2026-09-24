"use client";

import { useEffect, useRef } from "react";
import type { PlayerView } from "@/hooks/useGame";
import type { DailyRun, MiniGameKind } from "@/lib/data/types";
import { MINI_GAMES } from "@/lib/game/mini-games";
import { SCORE_UNITS } from "@/lib/game/scores";

/**
 * Today's challenge, always in sight under the journey card. Before playing it
 * launches the game at once; afterwards it shows your place and opens the ranking.
 */
export function DailyButton({ kind, runs, meId, onPlay, onOpen }: {
  kind: MiniGameKind;
  runs: DailyRun[];
  meId: string | null;
  onPlay: () => void;
  onOpen: () => void;
}) {
  const game = MINI_GAMES[kind];
  const index = runs.findIndex((run) => run.playerId === meId);
  const mine = index === -1 ? null : runs[index];
  return <button type="button" className="daily-button pointer-events-auto" data-done={Boolean(mine)}
    onClick={mine ? onOpen : onPlay}
    aria-label={mine ? `Défi du jour, ${game.title} : voir le classement` : `Jouer le défi du jour : ${game.title}`}>
    <span className="daily-button__seal" aria-hidden>{mine ? (index === 0 ? "👑" : index + 1) : "!"}</span>
    <span className="daily-button__text">
      <small>Défi du jour</small>
      <b>{game.title}</b>
    </span>
    <span className="daily-button__cta">{mine ? `${mine.score} ${SCORE_UNITS[kind]}` : "Jouer"}</span>
  </button>;
}

/** The day's ranking, after a run or on demand. */
export function DailySheet({ kind, runs, players, meId, onClose }: {
  kind: MiniGameKind;
  runs: DailyRun[];
  players: PlayerView[];
  meId: string | null;
  onClose: () => void;
}) {
  const game = MINI_GAMES[kind];
  const mine = runs.find((run) => run.playerId === meId);
  const byId = new Map(players.map((p) => [p.id, p]));
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") close.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return <div className="daily-overlay" role="dialog" aria-modal="true" aria-labelledby="daily-title" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="daily">
      <div className="daily__head">
        <div>
          <p className="daily__kicker">Défi du jour · même parcours pour toute la compagnie</p>
          <h3 id="daily-title">{game.title}</h3>
        </div>
        {mine ? <span className="daily__done">Joué · {mine.score} {SCORE_UNITS[kind]}</span> : null}
      </div>
      {runs.length ? <ol className="daily__ranking">
        {runs.slice(0, 8).map((run, index) => <li key={run.id} data-me={run.playerId === meId}>
          <span className="daily__rank">{index === 0 ? "👑" : index + 1}</span>
          <span className="daily__name">{byId.get(run.playerId)?.name ?? "?"}</span>
          <b>{run.score} {SCORE_UNITS[kind]}</b>
        </li>)}
      </ol> : <p className="daily__empty">Personne encore. La couronne du jour t’attend.</p>}
      <button type="button" className="daily__close" onClick={onClose} autoFocus>Reprendre la route</button>
    </section>
  </div>;
}
