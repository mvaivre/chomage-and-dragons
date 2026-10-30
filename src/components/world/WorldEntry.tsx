"use client";
import { t as tr } from "@/lib/i18n/index";
import { useLocale } from "@/lib/i18n/react";
import { getLocale, hasChosenLanguage, setLocale } from "@/lib/i18n/index";
import { LanguagePicker } from "@/components/hud/LanguagePicker";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { chooseWorldMode, hasChosenWorldMode, readWorldMode, type WorldMode } from "@/lib/client/world-mode";
import "./world-choice.css";
const Game = dynamic(() => import("../Game").then(module => module.Game), {
    ssr: false,
    loading: () => <main className="world-choice-loading" role="status">{tr("Le voyage se prépare…", undefined)}</main>,
});
/** Neither renderer nor the game store mounts until the player has chosen a world. */
export function WorldEntry({ slug }: {
    slug: string | null;
}) {
    const uiLocale = useLocale();
    const [initialMode, setInitialMode] = useState<WorldMode | null>(() => hasChosenWorldMode() && hasChosenLanguage() ? readWorldMode() : null);
    const dialog = useRef<HTMLDialogElement>(null);
    const heading = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        if (initialMode)
            return;
        const node = dialog.current;
        node?.showModal();
        heading.current?.focus();
        return () => node?.close();
    }, [initialMode]);
    if (initialMode)
        return <Game slug={slug} initialWorldMode={initialMode}/>;
    const enter = (mode: WorldMode) => { setLocale(getLocale()); chooseWorldMode(mode); setInitialMode(mode); };
    return <main className="world-choice-screen">
    <dialog ref={dialog} className="world-choice" aria-labelledby="world-choice-title" aria-describedby="world-choice-description" onCancel={event => event.preventDefault()}>
      <div className="world-choice__top"><LanguagePicker />
      <p className="world-choice__eyebrow">{tr("Chômage & Dragons", undefined, uiLocale)}</p></div>
      <h1 ref={heading} tabIndex={-1} id="world-choice-title">{tr("Choisis ton univers", undefined, uiLocale)}</h1>
      <p id="world-choice-description">{tr("La même aventure, deux façons de la vivre.", undefined, uiLocale)}</p>
      <div className="world-choice__options">
        <button type="button" className="world-choice__option" onClick={() => enter("2d")}>
          <span className="world-choice__preview world-choice__preview--2d" aria-hidden="true"><span>{tr("2D", undefined, uiLocale)}</span></span>
          <strong>{tr("Le conte illustré", undefined, uiLocale)}</strong>
          <span>{tr("Des paysages dessinés à la main, au fil du chemin.", undefined, uiLocale)}</span>
          <span className="world-choice__enter">{tr("Entrer en 2D ", undefined, uiLocale)}<span aria-hidden="true">→</span></span>
        </button>
        <button type="button" className="world-choice__option" onClick={() => enter("3d")}>
          <span className="world-choice__preview world-choice__preview--3d" aria-hidden="true"><span>{tr("3D", undefined, uiLocale)}</span></span>
          <strong>{tr("Le monde miniature", undefined, uiLocale)}</strong>
          <span>{tr("Un royaume en relief à explorer sous tous les angles.", undefined, uiLocale)}</span>
          <span className="world-choice__enter">{tr("Entrer en 3D ", undefined, uiLocale)}<span aria-hidden="true">→</span></span>
        </button>
      </div>
      <p className="world-choice__note">{tr("Tu pourras changer de vue à tout moment. Ta progression reste la même.", undefined, uiLocale)}</p>
    </dialog>
  </main>;
}
