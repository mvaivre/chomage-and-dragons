"use client";

import type { PlayerView } from "@/hooks/useGame";

/** Height of the painted route at a point of the traversal, in percent of the map. */
function mapRouteY(progress: number): number {
  const points = [67, 70, 69, 66, 60, 64, 68];
  const scaled = Math.max(0, Math.min(1, progress)) * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(scaled));
  const t = scaled - index;
  return points[index] + (points[index + 1] - points[index]) * t;
}

/** The painted itinerary with a pin per member of the company, at the top of the standings. */
export function JourneyMap({ players, meId }: { players: PlayerView[]; meId: string | null }) {
  return <div className="journey-map">
    <div className="journey-map__painting" role="img" aria-label="Carte médiévale du voyage de la compagnie" />
    <div className="journey-map__pins" aria-label="Position des joueurs">
      {players.map((player, index) => {
        const lap = player.position % 1 || (player.position > 0 ? 1 : 0);
        return <div
          key={player.id}
          className={`company-map-pin ${player.id === meId ? "is-me" : ""}`}
          style={{
            left: `${16 + lap * 68 + ((index % 3) - 1) * 1.25}%`,
            top: `${mapRouteY(lap) + ((index % 3) - 1) * 3.2}%`,
            zIndex: player.id === meId ? 20 : index + 1,
          }}
        >
          <span>{player.name.slice(0, 1).toUpperCase()}</span>
          <strong>{player.name} · {player.journeySteps} pas<small>Voyage {Math.max(1, Math.ceil(player.position))}</small></strong>
        </div>;
      })}
    </div>
  </div>;
}
