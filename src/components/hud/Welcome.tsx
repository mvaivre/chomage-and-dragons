"use client";
import { t as tr } from "@/lib/i18n/index";
import { useLocale } from "@/lib/i18n/react";

import { useEffect, useRef, useState } from "react";
import {
  advanceInitiation, createInitiationProgress, INITIATION_KEY,
  initiationStorageKey, parseInitiationProgress,
} from "@/lib/game/initiation";
import { sfx } from "@/lib/client/sound";
import { JourneyLesson } from "./initiation/JourneyLesson";
import { TreasureLesson } from "./initiation/TreasureLesson";
import { CompanyLesson } from "./initiation/CompanyLesson";

export const WELCOME_KEY = INITIATION_KEY;
export function hasSeenWelcome(scope?: string) {
  try { return localStorage.getItem(initiationStorageKey(scope)) === "seen"; } catch { return false; }
}
export function rememberWelcome(scope?: string) {
  try { localStorage.setItem(initiationStorageKey(scope), "seen"); } catch { /* Private browsing. */ }
}
function readProgress(scope?: string) {
  try { return parseInitiationProgress(localStorage.getItem(`${initiationStorageKey(scope)}:progress`));
    }
    catch {
        return createInitiationProgress();
    }
}
const rites = [
    { name: "Avancer", title: "Tes démarches font avancer" },
    { name: "Les butins", title: "Un coffre tous les 10 pas" },
    { name: "Ensemble", title: "Le voyage se partage" },
] as const;
export function Welcome({ onClose, scope, characterId = "barde" }: {
    onClose: () => void;
    scope?: string;
    characterId?: string;
}) {
    const uiLocale = useLocale();
    const dialog = useRef<HTMLDialogElement>(null), title = useRef<HTMLHeadingElement>(null), primary = useRef<HTMLButtonElement>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [progress, setProgress] = useState(() => readProgress(scope));
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        const node = dialog.current, previous = document.activeElement as HTMLElement | null;
        node?.showModal();
        title.current?.focus({ preventScroll: true });
        return () => {
            if (timer.current)
                clearTimeout(timer.current);
            node?.close();
            previous?.focus();
        };
    }, []);
    useEffect(() => {
        try {
            localStorage.setItem(`${initiationStorageKey(scope)}:progress`, JSON.stringify(progress));
        }
        catch { /* Training still works. */ }
    }, [progress, scope]);
    useEffect(() => {
        title.current?.focus({ preventScroll: true });
        const body = dialog.current?.querySelector(".initiation-card__body");
        if (body)
            body.scrollTop = 0;
    }, [progress.stage]);
    const leave = () => {
        rememberWelcome(scope);
        // A completed introduction replays from the start from the carnet.
        if (progress.stage === 2)
            try {
                localStorage.removeItem(`${initiationStorageKey(scope)}:progress`);
            }
            catch { /* Optional persistence. */ }
        onClose();
    };
    const advance = () => {
        if (busy)
            return;
        if (progress.stage === 2) {
            leave();
            return;
        }
        const demo = progress.stage === 0 ? !progress.journeyDone : !progress.powerCast;
        if (demo) {
            if (progress.stage === 0)
                sfx.press();
            else if (!progress.chestOpen)
                sfx.chime();
            else
                sfx.pop();
            if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
                setBusy(true);
                timer.current = setTimeout(() => { setBusy(false); primary.current?.focus({ preventScroll: true }); }, 750);
            }
        }
        setProgress(advanceInitiation);
    };
    const label = progress.stage === 0 ? progress.journeyDone ? "Découvrir les coffres →" : "Essayer une candidature · +2 pas"
        : progress.stage === 1 ? !progress.chestOpen ? "Ouvrir le coffre" : !progress.powerCast ? "Essayer le pouvoir" : "Voyager ensemble →" : "Commencer le voyage";
    return <dialog ref={dialog} className="initiation-card initiation-quick" aria-labelledby="initiation-title" onCancel={event => { event.preventDefault(); leave(); }} onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
    <header className="initiation-card__header"><div><p className="initiation-eyebrow">{tr("Les premiers pas", undefined, uiLocale)}</p><span className="initiation-card__subtitle">{tr("Trois petits essais · environ 20 secondes", undefined, uiLocale)}</span></div>
      <button className="initiation-close" type="button" onClick={leave} aria-label={tr("Fermer l’initiation", undefined, uiLocale)}>×</button>
    </header>
    <ol className="initiation-rites" aria-label={tr("Les trois rites", undefined, uiLocale)}>{rites.map((item, i) => <li key={item.name} data-current={i === progress.stage} data-complete={i < progress.stage} aria-current={i === progress.stage ? "step" : undefined}><span aria-hidden>{tr(i < progress.stage ? "✓" : i + 1, undefined, uiLocale)}</span><b>{tr(item.name, undefined, uiLocale)}</b></li>)}</ol>
    <div className="initiation-card__body">
      <h1 ref={title} id="initiation-title" tabIndex={-1}>{tr(rites[progress.stage].title, undefined, uiLocale)}</h1>
      {progress.stage === 0 ? <JourneyLesson characterId={characterId} complete={progress.journeyDone}/> : progress.stage === 1 ? <TreasureLesson characterId={characterId} chestOpen={progress.chestOpen} powerCast={progress.powerCast}/> : <CompanyLesson characterId={characterId}/>}
    </div>
    <footer className="initiation-card__footer">
      <button ref={primary} className="initiation-primary" type="button" onClick={advance} disabled={busy} aria-busy={busy}>{tr(label, undefined, uiLocale)}</button>
      <div className="initiation-card__links"><button type="button" onClick={leave}>{tr("Passer l’initiation", undefined, uiLocale)}</button><small>{tr("Un essai, pas une vraie démarche", undefined, uiLocale)}</small><button type="button" onClick={() => {
            if (timer.current)
                clearTimeout(timer.current);
            setBusy(false);
            setProgress(createInitiationProgress());
        }}>{tr("Recommencer", undefined, uiLocale)}</button></div>
    </footer>
  </dialog>;
}
