"use client";
import { t as tr } from "@/lib/i18n/index";
import { useLocale } from "@/lib/i18n/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { sfx } from "@/lib/client/sound";
import { dialogueTokens, letterDelay } from "@/lib/game/dialogue-text";

/** The full sentence is announced once; only the visual copy is typed letter by letter. */
export function Dialogue({
  text: sourceText,
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
  const uiLocale = useLocale();
  const text = tr(sourceText, undefined, uiLocale);
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
      const letter = String.fromCodePoint(text.codePointAt(cursor)!);
      cursor += letter.length;
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
    <aside className="travel-speech" data-typing={!done} data-line={text}>
      <small className="travel-speech__speaker">{tr(speaker, undefined, uiLocale)}</small>
      <button
        className="travel-speech__close"
        type="button"
        aria-label={tr("Fermer le dialogue"
        , undefined, uiLocale)} onClick={onClose}
      >
        ×
      </button>
      <p>
        <span className="sr-only" role="status">
          {text}
        </span>
        <span aria-hidden="true">
          {tokens.map((token) => {
            let offset = token.start;
            const content = Array.from(token.text).map((letter, i) => {
              const start = offset;
              offset += letter.length;
              return (
              <span
                key={i}
                style={{
                  visibility: start < visible ? "visible" : "hidden",
                }}
              >
                {letter}
              </span>
              );
            });
            return token.emphasis ? (
              <mark key={token.start}>{content}</mark>
            ) : (
              <span key={token.start}>{content}</span>
            );
          })}
        </span>
      </p>
      <div className="travel-speech__footer">
        {children}
        <button
          type="button"
          className="travel-speech__continue"
          onClick={done ? onClose : () => setVisible(text.length)}
        >
          {tr(done ? "Continuer ▾" : "Tout afficher ▾", undefined, uiLocale)}
        </button>
      </div>
    </aside>
  );
}
