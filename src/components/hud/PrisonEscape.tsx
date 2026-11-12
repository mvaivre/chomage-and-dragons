"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/react";
import { PRISON_KEYS, PRISON_PATH_LIMIT, PRISON_SIZE, prisonMaze, prisonMove, prisonStart, prisonWon, type PrisonDirection } from "@/lib/game/prison";
import { useDialogKeyboard } from "./useDialogKeyboard";

const arrows = { u: "↑", l: "←", d: "↓", r: "→" };
const names = { u: "Haut", l: "Gauche", d: "Bas", r: "Droite" };
const keyboard: Record<string, PrisonDirection> = { ArrowUp: "u", ArrowLeft: "l", ArrowDown: "d", ArrowRight: "r" };
const directions: PrisonDirection[] = ["u", "l", "d", "r"];

export function PrisonEscape({ castId, onEscape, onClose }: {
  castId: string;
  onEscape: (castId: string, path: string) => { escaped: boolean; rejected?: string };
  onClose: () => void;
}) {
  const locale = useLocale();
  const title = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const maze = useMemo(() => prisonMaze(castId), [castId]);
  const [run, setRun] = useState(prisonStart);
  const [error, setError] = useState<string | null>(null);
  const path = useRef("");
  const progress = useRef(run);
  const move = (direction: PrisonDirection) => {
    if (path.current.length >= PRISON_PATH_LIMIT) return;
    const next = prisonMove(maze, progress.current, direction);
    if (next === progress.current) return;
    progress.current = next;
    path.current += direction;
    setRun(next);
    if (prisonWon(maze, next)) {
      const result = onEscape(castId, path.current);
      if (!result.escaped) setError(result.rejected ?? "La cage résiste.");
    } else if (path.current.length === PRISON_PATH_LIMIT) {
      setError("Recommence le labyrinthe.");
    }
  };
  useDialogKeyboard(dialog, event => {
    const direction = keyboard[event.key];
    if (!direction) return;
    event.preventDefault();
    move(direction);
  });
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    node?.showModal();
    return () => { node?.close(); opener?.focus(); };
  }, []);
  const collected = maze.keys.filter((_, index) => run.keys & (1 << index)).length;
  return <dialog ref={dialog} className="prison-dialog" aria-labelledby={title}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header>
      <h2 id={title}>{t("Labyrinthe du cachot", undefined, locale)}</h2>
      <button type="button" aria-label={t("Fermer", undefined, locale)} onClick={onClose}>×</button>
    </header>
    <p>{t("Trouve les deux clés dans le noir, puis rejoins la sortie.", undefined, locale)}</p>
    <div className="prison-maze" aria-hidden="true">
      {maze.open.map((open, cell) => {
        const distance = Math.abs(cell % PRISON_SIZE - run.cell % PRISON_SIZE)
          + Math.abs(Math.floor(cell / PRISON_SIZE) - Math.floor(run.cell / PRISON_SIZE));
        const key = maze.keys.indexOf(cell);
        const visible = distance <= 2;
        const mark = !visible ? "dark" : cell === run.cell ? "hero" : cell === maze.exit ? "exit"
          : key >= 0 && !(run.keys & (1 << key)) ? "key" : open ? "floor" : "wall";
        return <span key={cell} data-cell={mark}>{mark === "key" ? "🔑" : mark === "exit" ? "▣" : ""}</span>;
      })}
    </div>
    <div className="prison-dialog__footer">
      <p role="status">{t("{0}/{1} clés", [collected, PRISON_KEYS], locale)}</p>
      <div className="prison-controls" aria-label={t("Déplacements", undefined, locale)}>
        {directions.map(direction => <button key={direction} type="button" data-direction={direction}
          aria-label={t(names[direction], undefined, locale)} onClick={() => move(direction)}>{arrows[direction]}</button>)}
      </div>
      <button type="button" className="prison-restart" onClick={() => {
        path.current = "";
        progress.current = prisonStart();
        setRun(progress.current);
        setError(null);
      }}>{t("Recommencer", undefined, locale)}</button>
    </div>
    {error ? <p role="alert">{t(error, undefined, locale)}</p> : null}
  </dialog>;
}
