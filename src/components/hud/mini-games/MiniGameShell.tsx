"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import type { MiniGameKind } from "@/lib/data/types";
import { GameArtwork } from "../Artwork";
import { useDialogKeyboard } from "../useDialogKeyboard";

export type MiniGameKeyEvent = globalThis.KeyboardEvent;

export interface MiniGameShellProps {
  kind: MiniGameKind;
  eyebrow: string;
  title: string;
  instructions: ReactNode;
  /** Counters and gauges shown in a strip above the arena. */
  hud?: ReactNode;
  /** A readable briefing inside the arena before the explicit start action. */
  launchContent?: ReactNode;
  /** Live region under the arena: the current stake, then the outcome. */
  status: ReactNode;
  primary: { label: string; disabled?: boolean; onClick: () => void; inArena?: boolean; hidden?: boolean };
  skip?: { label: string; onClick: () => void } | null;
  /** Close button and Escape. Games count an unfinished attempt as skipped here. */
  onLeave: () => void;
  onKeyDown?: (event: MiniGameKeyEvent) => void;
  /** Changing it moves focus back to the primary button. */
  focusKey?: unknown;
  children: ReactNode;
}

/**
 * The shared frame of every mini-game: a native modal dialog owning focus,
 * Escape and the keyboard, with the same header, arena slot, live status and
 * contextual actions. The start action sits over the arena. Games only differ inside the arena and in their copy.
 */
export function MiniGameShell({ kind, eyebrow, title, instructions, hud, launchContent, status, primary, skip, onLeave, onKeyDown, focusKey, children }: MiniGameShellProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const primaryButton = useRef<HTMLButtonElement>(null);
  useDialogKeyboard(dialog, onKeyDown);

  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    primaryButton.current?.focus();
    return () => {
      node?.close();
      requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".action-button:not(:disabled)")?.focus());
    };
  }, []);

  // Transfer focus in the same commit as a disabled start button. Some browsers
  // leave activeElement on that disabled button, where element key handlers miss it.
  useLayoutEffect(() => {
    const node = dialog.current, active = document.activeElement;
    if (!primary.disabled && !primary.hidden) primaryButton.current?.focus({ preventScroll: true });
    else if (node && (!active || active === document.body || !node.contains(active) || active.matches(":disabled") || (active === primaryButton.current && primary.hidden))) node.focus({ preventScroll: true });
  }, [primary.disabled, primary.hidden, primary.inArena, focusKey]);

  // Chrome may close a modal on Escape without firing cancel when it opened right after
  // another one closed; onClose keeps the game state in step with the browser either way.
  // The check on `open` ignores the close queued by a development-only remount (StrictMode),
  // which has already reopened the dialog by the time the event fires.
  // Keys stay in the dialog: a digit for a quiz answer must not declare an action behind it.
  const primaryAction = !primary.hidden ? <button ref={primaryButton} type="button" className="mini-game__primary" disabled={primary.disabled} onClick={primary.onClick}>{primary.label}</button> : null;
  return <dialog ref={dialog} tabIndex={-1} className={`mini-game mini-game--${kind}`} aria-labelledby="mini-game-title" aria-describedby="mini-game-instructions"
    onCancel={event => { event.preventDefault(); onLeave(); }}
    onClose={event => { if (!event.currentTarget.open) onLeave(); }}>
    <button type="button" className="mini-game__close" onClick={onLeave} aria-label="Fermer le mini-jeu">×</button>
    <header>
      <GameArtwork kind={kind} className="mini-game__heading-icon" />
      <p className="mini-game__eyebrow">{eyebrow}</p>
      <h2 id="mini-game-title">{title}</h2>
      <p id="mini-game-instructions">{instructions}</p>
    </header>
    {hud ? <div className="mini-game__hud" aria-hidden>{hud}</div> : null}
    <div className="mini-game__playfield">
      {children}
      {primary.inArena ? <div className={`mini-game__arena-launch${launchContent ? " mini-game__arena-launch--briefing" : ""}`}>{launchContent}{primaryAction}</div> : null}
    </div>
    <div className="mini-game__result" role="status" aria-live="polite">{status}</div>
    <footer>
      {!primary.inArena ? primaryAction : null}
      {skip ? <button type="button" className="mini-game__skip" onClick={skip.onClick}>{skip.label}</button> : null}
    </footer>
  </dialog>;
}

/** Shared by every game: which keys count as the main action. */
export const ACTION_KEYS = new Set([" ", "Spacebar", "Enter", "ArrowUp"]);

export interface MiniGameProps {
  characterId?: string;
  /** Seeds the course, so a saved attempt always shows the same one. */
  seedId: string;
  onResolve: (result: "won" | "lost" | "skipped", score?: number) => void;
  onDone: () => void;
  /** Development rehearsal: nothing is saved, the copy says so. */
  practice?: boolean;
  /** The group's record and your best, to beat. */
  record?: { score: number; holder: string } | null;
  best?: number | null;
}

/** "Score · record" line under a finished game. A practice run is never a record. */
export function ScoreLine({ score, unit, record, best, practice = false }: { score: number | null; unit: string; record?: { score: number; holder: string } | null; best?: number | null; practice?: boolean }) {
  if (score === null) return null;
  if (practice) return <p className="mini-game__score-line"><b>{score} {unit}</b><span>Entraînement · non enregistré</span></p>;
  const newRecord = !record || score > record.score;
  const newBest = best === null || best === undefined || score > best;
  return <p className="mini-game__score-line" data-record={newRecord}>
    <b>{score} {unit}</b>
    {newRecord ? <span>Nouveau record de la compagnie !</span>
      : newBest ? <span>Record perso · la compagnie : {record!.score} {unit} ({record!.holder})</span>
      : <span>Record : {record!.score} {unit} ({record!.holder})</span>}
  </p>;
}
