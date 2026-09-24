"use client";

import type { PlayerView } from "@/hooks/useGame";
import type { DailyRun, MiniGameKind } from "@/lib/data/types";
import { MINI_GAMES } from "@/lib/game/mini-games";
import { SCORE_UNITS } from "@/lib/game/scores";

/** Today's challenge, at the top of the chronicle: the game, the ranking, a button. */
export function DailyChallenge({ kind, runs, players, meId, onPlay }: {
  kind: MiniGameKind;
  runs: DailyRun[];
  players: PlayerView[];
  meId: string | null;
  onPlay: () => void;
}) {
  const game = MINI_GAMES[kind];
  const mine = runs.find((run) => run.playerId === meId);
  const byId = new Map(players.map((p) => [p.id, p]));
  return <section className="daily" aria-labelledby="daily-title">
    <div className="daily__head">
      <div>
        <p className="daily__kicker">Défi du jour · même parcours pour toute la compagnie</p>
        <h3 id="daily-title">{game.title}</h3>
      </div>
      {mine ? <span className="daily__done">Joué · {mine.score} {SCORE_UNITS[kind]}</span>
        : meId ? <button type="button" className="daily__play" onClick={onPlay}>Tenter ma chance</button> : null}
    </div>
    {runs.length ? <ol className="daily__ranking">
      {runs.slice(0, 5).map((run, index) => <li key={run.id} data-me={run.playerId === meId}>
        <span className="daily__rank">{index === 0 ? "👑" : index + 1}</span>
        <span className="daily__name">{byId.get(run.playerId)?.name ?? "?"}</span>
        <b>{run.score} {SCORE_UNITS[kind]}</b>
      </li>)}
    </ol> : <p className="daily__empty">Personne encore. La couronne du jour t’attend.</p>}
  </section>;
}
