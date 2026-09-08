import type { GameEvent, GameState, PigeonResult } from "@/lib/data/types";

export const PIGEON_DURATION_MS = 12_000;
export const MAILBOX_Y = 50;
export const MAILBOX_TOLERANCE = 9;

/** A readable back-and-forth approach; coordinates are percentages of the arena. */
export function pigeonAltitude(elapsedMs: number): number {
  return 50 - Math.cos(elapsedMs / 1000 * Math.PI * 0.7) * 27;
}

export function pigeonHitsMailbox(altitude: number): boolean {
  return Math.abs(altitude - MAILBOX_Y) <= MAILBOX_TOLERANCE;
}

/** Reserve before offering the game. Reloading or undoing never creates a retry. */
export function reservePigeonFlight(state: GameState, event: GameEvent) {
  if (event.kind !== "candidature") return { state, event, offerPigeon: false };
  const slot = state.events.filter(e => e.playerId === event.playerId && e.kind === "candidature").length;
  const previous = state.pigeonFlights?.find(f => f.playerId === event.playerId && f.slot === slot);
  const flight = previous ?? { id: event.id, eventId: event.id, playerId: event.playerId, slot, result: "pending" as const };
  return {
    state: previous ? state : { ...state, pigeonFlights: [...state.pigeonFlights ?? [], flight] },
    event: { ...event, pigeonFlightId: flight.id, ...(flight.result === "hit" ? { journeyMultiplier: 2 as const } : {}) },
    offerPigeon: !previous,
  };
}

/** Award once, on the original still-present event. A stale result is harmless. */
export function resolvePigeonFlight(state: GameState, eventId: string, result: PigeonResult): GameState {
  const event = state.events.find(e => e.id === eventId && e.kind === "candidature");
  const flight = state.pigeonFlights?.find(f => f.id === event?.pigeonFlightId && f.eventId === eventId);
  if (!event || !flight || flight.result !== "pending") return state;
  return {
    ...state,
    pigeonFlights: state.pigeonFlights?.map(f => f.id === flight.id ? { ...f, result } : f),
    events: result === "hit" ? state.events.map(e => e.id === eventId ? { ...e, journeyMultiplier: 2 } : e) : state.events,
  };
}
