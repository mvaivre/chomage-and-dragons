"use client";

import type { PlayerView } from "@/hooks/useGame";
import { useEffect, useMemo, useRef, useState } from "react";

/** Height of the painted route at a point of the traversal, in percent of the map. */
function mapRouteY(progress: number): number {
  const points = [67, 70, 69, 66, 60, 64, 68];
  const scaled = Math.max(0, Math.min(1, progress)) * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(scaled));
  const t = scaled - index;
  return points[index] + (points[index + 1] - points[index]) * t;
}

/** The painted itinerary with a pin per member of the company, at the top of the standings. */
export function JourneyMap({ players, meId, onLocate }: { players: PlayerView[]; meId: string | null; onLocate: (id: string) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 600, height: 400 });
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const measure = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, []);
  // Nearby travellers must each retain a visible, finger-sized target.
  const pins = useMemo(() => {
    const placed: { x: number; y: number; routeX: number; routeY: number }[] = [];
    const offsets = Array.from({ length: 225 }, (_, i) => ({ x: (i % 15 - 7) * 48, y: (Math.floor(i / 15) - 7) * 48 }))
      .sort((a, b) => a.x * a.x + a.y * a.y - b.x * b.x - b.y * b.y);
    return players.map(player => {
      const lap = player.position % 1 || (player.position > 0 ? 1 : 0);
      const routeX = (16 + lap * 68) * size.width / 100, routeY = mapRouteY(lap) * size.height / 100;
      const fit = offsets.map(offset => ({ x: Math.max(24, Math.min(size.width - 24, routeX + offset.x)), y: Math.max(24, Math.min(size.height - 24, routeY + offset.y)) }))
        .find(point => placed.every(other => Math.hypot(other.x - point.x, other.y - point.y) >= 46));
      const pin = { ...(fit ?? { x: routeX, y: routeY }), routeX, routeY };
      placed.push(pin);
      return pin;
    });
  }, [players, size]);
  return <div ref={root} className="journey-map">
    <div className="journey-map__painting" role="img" aria-label="Carte médiévale du voyage de la compagnie" />
    <svg className="journey-map__connections" aria-hidden="true" width="100%" height="100%">
      {pins.map((pin, index) => <line key={players[index].id} x1={pin.routeX} y1={pin.routeY} x2={pin.x} y2={pin.y} />)}
    </svg>
    <div className="journey-map__pins" aria-label="Position des joueurs">
      {players.map((player, index) => {
        return <button type="button"
          key={player.id}
          onClick={() => onLocate(player.id)}
          aria-label={`Voir ${player.name} dans le monde`}
          title={`Voir ${player.name} dans le monde`}
          className={`company-map-pin ${player.id === meId ? "is-me" : ""}`}
          style={{
            left: pins[index].x,
            top: pins[index].y,
            zIndex: player.id === meId ? 20 : index + 1,
          }}
        >
          <span>{player.name.slice(0, 1).toUpperCase()}</span>
          <strong>{player.name} · {player.journeySteps} pas<small>Voyage {Math.max(1, Math.ceil(player.position))}</small></strong>
        </button>;
      })}
    </div>
  </div>;
}
