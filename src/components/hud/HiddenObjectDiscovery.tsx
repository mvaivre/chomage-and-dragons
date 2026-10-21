"use client";

import { useEffect, useRef } from "react";
import { HIDDEN_ITEMS, type HiddenItem } from "@/lib/game/hidden-objects";
import "./hidden-object-discovery.css";

export function HiddenObjectDiscovery({ item, onClose, onCollection }: {
  item: HiddenItem;
  onClose: () => void;
  onCollection: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    node?.showModal();
    return () => { node?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className="hidden-discovery" aria-labelledby="hidden-discovery-title" aria-describedby="hidden-discovery-rules"
    onKeyDown={event => event.stopPropagation()} onCancel={event => { event.preventDefault(); onClose(); }}>
    <small>Objets perdus · 1/{HIDDEN_ITEMS.length}</small>
    <h2 id="hidden-discovery-title">Premier objet trouvé !</h2>
    <figure>
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-optimized local alpha art */}
      <img src={item.art} width={88} height={88} alt="" />
      <figcaption>{item.name}</figcaption>
    </figure>
    <div id="hidden-discovery-rules">
      <p>{HIDDEN_ITEMS.length} objets cachés, un par contrée.<br />Glisse pour explorer. Touche pour ramasser.</p>
      <p>Collection et indices dans <strong>Quêtes → Objets perdus.</strong></p>
    </div>
    <footer>
      <button type="button" onClick={onClose} autoFocus>J’ai compris</button>
      <button type="button" onClick={onCollection}>Voir ma collection</button>
    </footer>
  </dialog>;
}
