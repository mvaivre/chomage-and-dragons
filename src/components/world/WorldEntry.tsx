"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { chooseWorldMode, hasChosenWorldMode, readWorldMode, type WorldMode } from "@/lib/client/world-mode";
import "./world-choice.css";

const Game = dynamic(() => import("../Game").then(module => module.Game), {
  ssr: false,
  loading: () => <main className="world-choice-loading" role="status">Le voyage se prépare…</main>,
});

/** Neither renderer nor the game store mounts until the player has chosen a world. */
export function WorldEntry({ slug }: { slug: string | null }) {
  const [initialMode, setInitialMode] = useState<WorldMode | null>(() => hasChosenWorldMode() ? readWorldMode() : null);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (initialMode) return;
    const node = dialog.current;
    node?.showModal();
    heading.current?.focus();
    return () => node?.close();
  }, [initialMode]);

  if (initialMode) return <Game slug={slug} initialWorldMode={initialMode} />;
  const enter = (mode: WorldMode) => { chooseWorldMode(mode); setInitialMode(mode); };
  return <main className="world-choice-screen">
    <dialog ref={dialog} className="world-choice" aria-labelledby="world-choice-title" aria-describedby="world-choice-description" onCancel={event => event.preventDefault()}>
      <p className="world-choice__eyebrow">Chômage &amp; Dragons</p>
      <h1 ref={heading} tabIndex={-1} id="world-choice-title">Choisis ton univers</h1>
      <p id="world-choice-description">La même aventure, deux façons de la vivre.</p>
      <div className="world-choice__options">
        <button type="button" className="world-choice__option" onClick={() => enter("2d")}>
          <span className="world-choice__preview world-choice__preview--2d" aria-hidden="true"><span>2D</span></span>
          <strong>Le conte illustré</strong>
          <span>Des paysages dessinés à la main, au fil du chemin.</span>
          <span className="world-choice__enter">Entrer en 2D <span aria-hidden="true">→</span></span>
        </button>
        <button type="button" className="world-choice__option" onClick={() => enter("3d")}>
          <span className="world-choice__preview world-choice__preview--3d" aria-hidden="true"><span>3D</span></span>
          <strong>Le monde miniature</strong>
          <span>Un royaume en relief à explorer sous tous les angles.</span>
          <span className="world-choice__enter">Entrer en 3D <span aria-hidden="true">→</span></span>
        </button>
      </div>
      <p className="world-choice__note">Tu pourras changer de vue à tout moment. Ta progression reste la même.</p>
    </dialog>
  </main>;
}
