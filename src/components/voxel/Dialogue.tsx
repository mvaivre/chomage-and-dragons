"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { sfx } from "@/lib/client/sound";
import { dialogueTokens, letterDelay } from "./dialogue-text";

/** The full sentence is announced once; only the visual copy is typed letter by letter. */
export function Dialogue({
  text,
  speaker,
  paused,
  onClose,
  children,
}: {
  text: string;
  speaker: string;
  paused: boolean;
  onClose: () => void;
  children?: ReactNode;
}) {
  const [visible, setVisible] = useState(0);
  const tokens = useMemo(() => dialogueTokens(text), [text]);
  const done = visible >= text.length;
  useEffect(() => {
    if (done || paused) return;
    let cursor = visible;
    let timer: ReturnType<typeof setTimeout>;
    const advance = () => {
      if (document.hidden) {
        timer = setTimeout(advance, 100);
        return;
      }
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setVisible(text.length);
        return;
      }
      const letter = text[cursor++];
      setVisible(cursor);
      if (/[\p{L}\p{N}]/u.test(letter)) sfx.dialogue(letter);
      if (cursor < text.length)
        timer = setTimeout(advance, letterDelay(letter));
    };
    timer = setTimeout(advance, 32);
    return () => clearTimeout(timer);
    // The timer owns its cursor, so rendering a letter doesn't restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, paused, done]);
  return (
    <aside className="voxel-speech" data-typing={!done} data-line={text}>
      <small className="voxel-speech__speaker">{speaker}</small>
      <button
        className="voxel-speech__close"
        type="button"
        aria-label="Fermer le dialogue"
        onClick={onClose}
      >
        ×
      </button>
      <p>
        <span className="sr-only" role="status">
          {text}
        </span>
        <span aria-hidden="true">
          {tokens.map((token) => {
            const content = Array.from(token.text).map((letter, i) => (
              <span
                key={i}
                style={{
                  visibility: token.start + i < visible ? "visible" : "hidden",
                }}
              >
                {letter}
              </span>
            ));
            return token.emphasis ? (
              <mark key={token.start}>{content}</mark>
            ) : (
              <span key={token.start}>{content}</span>
            );
          })}
        </span>
      </p>
      <div className="voxel-speech__footer">
        {children}
        <button
          type="button"
          className="voxel-speech__continue"
          onClick={done ? onClose : () => setVisible(text.length)}
        >
          {done ? "Continuer ▾" : "Tout afficher ▾"}
        </button>
      </div>
    </aside>
  );
}
