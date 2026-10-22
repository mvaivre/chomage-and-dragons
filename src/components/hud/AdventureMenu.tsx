"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { MiniGameKind } from "@/lib/data/types";
import { MINI_GAMES } from "@/lib/game/mini-games";
import { HIDDEN_ITEMS, hiddenBiomeLabel } from "@/lib/game/hidden-objects";
import { CharacterPortrait } from "./CharacterPortrait";
import { characterById } from "@/lib/game/characters";
import { BIOMES, WORLD_LENGTH } from "@/lib/game/world";

const BADGES: Record<string, string> = {
  dragon: "🐉",
  pigeon: "🕊",
  keywords: "📜",
  stamp: "🔨",
  quiz: "🔮",
  ghosting: "👻",
  slots: "💰",
  pigeonRace: "🏁",
  paperCut: "⚔",
  snake: "🐍",
  maze: "🕯",
  stack: "🧱",
  pong: "🏓",
};

export function AdventureMenu({
  foundIds,
  initialTab = "games",
  onClose,
  onPlay,
  onExplore,
  onInitiation,
  name,
  characterId,
  children,
}: {
  name: string;
  characterId: string;
  children?: ReactNode;
  foundIds: readonly string[];
  initialTab?: "journey" | "games" | "hunt";
  onClose: () => void;
  onPlay: (kind: MiniGameKind) => void;
  onExplore: (x: number) => void;
  onInitiation: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<"journey" | "games" | "hunt">(initialTab);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current;
    node?.showModal();
    return () => {
      node?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="adventure-menu"
      aria-labelledby="adventure-title"
      onKeyDown={(event) => event.stopPropagation()}
      onCancel={(event) => {
        // The meetup editor is a nested native dialog and owns its own Escape.
        if (event.target !== event.currentTarget) return;
        event.preventDefault();
        onClose();
      }}
    >
      <header>
        <small>{name} · carnet de voyage</small>
        <h2 id="adventure-title">
          {tab === "journey"
            ? "L’aventure t’attend"
            : tab === "games"
              ? "Quêtes"
              : "Objets perdus"}
        </h2>
        <button type="button" aria-label="Fermer le carnet" onClick={onClose}>
          ×
        </button>
      </header>
      <div
        className="adventure-menu__tabs"
        role="group"
        aria-label="Pages du carnet"
      >
        <button
          type="button"
          aria-pressed={tab === "journey"}
          onClick={() => setTab("journey")}
        >
          Personnage
        </button>
        <button
          type="button"
          aria-pressed={tab === "games"}
          onClick={() => setTab("games")}
        >
          Quêtes
        </button>
        <button
          type="button"
          aria-pressed={tab === "hunt"}
          onClick={() => setTab("hunt")}
        >
          Objets perdus · {foundIds.length}/{HIDDEN_ITEMS.length}
        </button>
      </div>
      {tab === "journey" ? (
        <div className="adventure-menu__profile">
          <div className="journal-hero"><CharacterPortrait character={characterById(characterId)} interactive /><div><small>Ton compagnon de route</small><h3>{characterById(characterId).name}</h3><p>{characterById(characterId).blurb}</p></div></div>
          <button
            className="adventure-menu__profile-link"
            type="button"
            onClick={() => setTab("games")}
          >
            Les quêtes de traverse <span>13 défis à découvrir →</span>
          </button>
          {children}
        </div>
      ) : tab === "games" ? (
        <>
          <p className="adventure-menu__intro">
            Entraîne-toi sans modifier ton score
          </p>
          <button
            className="adventure-menu__initiation"
            type="button"
            onClick={onInitiation}
          >
            🐉 Les rites d’initiation <span>Apprendre à jouer</span>
          </button>
          <div className="adventure-menu__games">
            {Object.values(MINI_GAMES).map((game) => (
              <button
                key={game.kind}
                type="button"
                onClick={() => onPlay(game.kind)}
              >
                <span aria-hidden="true">{BADGES[game.kind] ?? "⚔"}</span>
                <div>
                  <strong>{game.title}</strong>
                  <small>{game.misery}</small>
                </div>
                <b aria-hidden="true">↗</b>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="adventure-menu__intro">
            Clique sur les objets cachés dans le décor pour les collectionner
          </p>
          <div className="adventure-menu__collection">
            {HIDDEN_ITEMS.map((item) => {
              const found = foundIds.includes(item.id);
              const biome = BIOMES.find((biome) => biome.id === item.biome)!;
              return (
                <article key={item.id} data-found={found}>
                  <span className="adventure-menu__relic" aria-hidden="true">
                    {found ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- pre-optimized local alpha art */
                      <img
                        src={`/art/world-v3/collectibles/${item.model}.webp`}
                        width={64}
                        height={64}
                        alt=""
                      />
                    ) : (
                      "?"
                    )}
                  </span>
                  <div>
                    <small>{hiddenBiomeLabel(item)}</small>
                    <h3>{found ? item.name : "Objet caché"}</h3>
                    {!found ? (
                      <details>
                        <summary>Un indice ?</summary>
                        <p>{item.clue}</p>
                      </details>
                    ) : null}
                    {!found ? (
                      <button
                        type="button"
                        onClick={() =>
                          onExplore((biome.from + 0.018) * WORLD_LENGTH)
                        }
                      >
                        Explorer →
                      </button>
                    ) : (
                      <b>Retrouvé ✓</b>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {foundIds.length === HIDDEN_ITEMS.length ? (
            <p className="adventure-menu__complete">Collection complète !</p>
          ) : null}
        </>
      )}
      <footer>
        <button type="button" onClick={onClose}>
          Retour au voyage
        </button>
      </footer>
    </dialog>
  );
}
