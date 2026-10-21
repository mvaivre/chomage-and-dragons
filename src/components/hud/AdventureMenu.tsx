"use client";

import { useEffect, useRef, useState } from "react";
import type { MiniGameKind } from "@/lib/data/types";
import { MINI_GAMES } from "@/lib/game/mini-games";
import { HIDDEN_ITEMS, hiddenBiomeLabel } from "@/lib/game/hidden-objects";
import { BIOMES, WORLD_LENGTH } from "@/lib/game/world";

const BADGES: Record<string, string> = { dragon: "🐉", pigeon: "🕊", keywords: "📜", stamp: "🔨", quiz: "🔮", ghosting: "👻", slots: "💰", pigeonRace: "🏁", paperCut: "⚔", snake: "🐍", maze: "🕯", stack: "🧱", pong: "🏓" };

export function AdventureMenu({ foundIds, initialTab = "games", onClose, onPlay, onExplore, onInitiation }: {
  foundIds: readonly string[];
  initialTab?: "games" | "hunt";
  onClose: () => void;
  onPlay: (kind: MiniGameKind) => void;
  onExplore: (x: number) => void;
  onInitiation: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<"games" | "hunt">(initialTab);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    node?.showModal();
    return () => { node?.close(); previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className="adventure-menu" aria-labelledby="adventure-title"
    onKeyDown={event => event.stopPropagation()} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header><small>Les quêtes de traverse</small><h2 id="adventure-title">Quêtes</h2>
      <button type="button" aria-label="Fermer les quêtes" onClick={onClose}>×</button></header>
    <div className="adventure-menu__tabs" role="group" aria-label="Choisir une quête">
      <button type="button" aria-pressed={tab === "games"} onClick={() => setTab("games")}>La salle des défis</button>
      <button type="button" aria-pressed={tab === "hunt"} onClick={() => setTab("hunt")}>Objets perdus · {foundIds.length}/{HIDDEN_ITEMS.length}</button>
    </div>
    {tab === "games" ? <>
      <p className="adventure-menu__intro">Entraîne-toi sans modifier ton score</p>
      <button className="adventure-menu__initiation" type="button" onClick={onInitiation}>🐉 Les rites d’initiation <span>Apprendre à jouer</span></button>
      <div className="adventure-menu__games">
        {Object.values(MINI_GAMES).map(game => <button key={game.kind} type="button" onClick={() => onPlay(game.kind)}>
          <span aria-hidden="true">{BADGES[game.kind] ?? "⚔"}</span><div><strong>{game.title}</strong><small>{game.misery}</small></div><b aria-hidden="true">↗</b>
        </button>)}
      </div>
    </> : <>
      <p className="adventure-menu__intro">Clique sur les objets cachés dans le décor pour les collectionner</p>
      <div className="adventure-menu__collection">
        {HIDDEN_ITEMS.map(item => {
          const found = foundIds.includes(item.id);
          const biome = BIOMES.find(biome => biome.id === item.biome)!;
          return <article key={item.id} data-found={found}>
            <span className="adventure-menu__relic" aria-hidden="true">{found ?
              /* eslint-disable-next-line @next/next/no-img-element -- pre-optimized local alpha art */
              <img src={item.art} width={64} height={64} alt="" /> : "?"}</span>
            <div><small>{hiddenBiomeLabel(item)}</small><h3>{found ? item.name : "Objet caché"}</h3>
              {!found ? <details><summary>Un indice ?</summary><p>{item.clue}</p></details> : null}
              {!found ? <button type="button" onClick={() => onExplore((biome.from + .018) * WORLD_LENGTH)}>Explorer →</button> : <b>Retrouvé ✓</b>}
            </div>
          </article>;
        })}
      </div>
      {foundIds.length === HIDDEN_ITEMS.length ? <p className="adventure-menu__complete">Collection complète !</p> : null}
    </>}
    <footer><button type="button" onClick={onClose}>Retour au voyage</button></footer>
  </dialog>;
}
