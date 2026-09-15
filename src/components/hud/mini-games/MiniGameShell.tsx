"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import type { MiniGameKind } from "@/lib/data/types";

export interface MiniGameShellProps {
  kind: MiniGameKind;
  eyebrow: string;
  title: string;
  instructions: ReactNode;
  /** Counters and gauges shown in a strip above the arena. */
  hud?: ReactNode;
  /** Live region under the arena: the current stake, then the outcome. */
  status: ReactNode;
  primary: { label: string; disabled?: boolean; onClick: () => void };
  skip?: { label: string; onClick: () => void } | null;
  /** Close button and Escape. Games count an unfinished attempt as skipped here. */
  onLeave: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDialogElement>) => void;
  /** Changing it moves focus back to the primary button. */
  focusKey?: unknown;
  children: ReactNode;
}

/**
 * The shared frame of every mini-game: a native modal dialog owning focus,
 * Escape and the keyboard, with the same header, arena slot, live status and
 * two buttons. Games only differ inside the arena and in their copy.
 */
export function MiniGameShell({ kind, eyebrow, title, instructions, hud, status, primary, skip, onLeave, onKeyDown, focusKey, children }: MiniGameShellProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const primaryButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    primaryButton.current?.focus();
    return () => {
      node?.close();
      requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".action-button:not(:disabled)")?.focus());
    };
  }, []);

  useEffect(() => { primaryButton.current?.focus(); }, [focusKey]);

  // Chrome may close a modal on Escape without firing cancel when it opened right after
  // another one closed; onClose keeps the game state in step with the browser either way.
  return <dialog ref={dialog} className={`mini-game mini-game--${kind}`} aria-labelledby="mini-game-title" aria-describedby="mini-game-instructions"
    onKeyDown={onKeyDown} onCancel={event => { event.preventDefault(); onLeave(); }} onClose={onLeave}>
    <button type="button" className="mini-game__close" onClick={onLeave} aria-label="Fermer le mini-jeu">×</button>
    <header>
      <p className="mini-game__eyebrow">{eyebrow}</p>
      <h2 id="mini-game-title">{title}</h2>
      <p id="mini-game-instructions">{instructions}</p>
    </header>
    {hud ? <div className="mini-game__hud" aria-hidden>{hud}</div> : null}
    {children}
    <div className="mini-game__result" role="status" aria-live="polite">{status}</div>
    <footer>
      <button ref={primaryButton} type="button" className="mini-game__primary" disabled={primary.disabled} onClick={primary.onClick}>{primary.label}</button>
      {skip ? <button type="button" className="mini-game__skip" onClick={skip.onClick}>{skip.label}</button> : null}
    </footer>
  </dialog>;
}

/** Shared by every game: which keys count as the main action. */
export const ACTION_KEYS = new Set([" ", "Spacebar", "Enter", "ArrowUp"]);

export interface MiniGameProps {
  /** Seeds the course, so a saved attempt always shows the same one. */
  seedId: string;
  onResolve: (result: "won" | "lost" | "skipped") => void;
  onDone: () => void;
  /** Development rehearsal: nothing is saved, the copy says so. */
  practice?: boolean;
}
