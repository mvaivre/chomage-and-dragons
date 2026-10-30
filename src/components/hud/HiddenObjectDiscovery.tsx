"use client";
import { t as tr } from "@/lib/i18n/index";
import { useLocale } from "@/lib/i18n/react";
import { RelicArtwork } from "./Artwork";
import { useEffect, useRef } from "react";
import { HIDDEN_ITEMS, type HiddenItem } from "@/lib/game/hidden-objects";
export function HiddenObjectDiscovery({ item, onClose, onCollection }: {
    item: HiddenItem;
    onClose: () => void;
    onCollection: () => void;
}) {
    const uiLocale = useLocale();
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        const node = dialog.current;
        node?.showModal();
        return () => { node?.close(); previous?.focus(); };
    }, []);
    return <dialog ref={dialog} className="hidden-discovery" aria-labelledby="hidden-discovery-title" aria-describedby="hidden-discovery-rules" onKeyDown={event => event.stopPropagation()} onCancel={event => { event.preventDefault(); onClose(); }}>
    <small>{tr("Collection 1 sur ", undefined, uiLocale)}{HIDDEN_ITEMS.length}</small>
    <h2 id="hidden-discovery-title">{tr("Objets cachés", undefined, uiLocale)}</h2>
    <figure>
      <RelicArtwork src={item.art} className="hidden-discovery__art"/>
      <figcaption>{tr(item.name, undefined, uiLocale)}</figcaption>
    </figure>
    <div id="hidden-discovery-rules">
      <p>{tr("Clique sur les objets cachés dans le décor pour compléter ta collection", undefined, uiLocale)}</p>
    </div>
    <footer>
      <button type="button" onClick={onClose} autoFocus>{tr("Continuer", undefined, uiLocale)}</button>
      <button type="button" onClick={onCollection}>{tr("Voir ma collection", undefined, uiLocale)}</button>
    </footer>
  </dialog>;
}
