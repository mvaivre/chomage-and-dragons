"use client";
import { t as tr } from "@/lib/i18n/index";
import { useLocale } from "@/lib/i18n/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { MiniGameKind, WildEncounter } from "@/lib/data/types";
import { PLAYABLE_MINI_GAMES } from "@/lib/game/mini-games";
import { CaptureCollection } from "./CaptureCollection";
import { HIDDEN_ITEMS, hiddenBiomeLabel } from "@/lib/game/hidden-objects";
import { GameArtwork, RelicArtwork } from "./Artwork";
import { UiIcon } from "./UiIcon";
import { CharacterPortrait } from "./CharacterPortrait";
import { characterById } from "@/lib/game/characters";
import { BIOMES, WORLD_LENGTH } from "@/lib/game/world";
export function AdventureMenu({ foundIds, encounters, initialTab = "games", onClose, onPlay, onExplore, onInitiation, name, characterId, children, }: {
    name: string;
    characterId: string;
    children?: ReactNode;
    foundIds: readonly string[];
    encounters: readonly WildEncounter[];
    initialTab?: "journey" | "games" | "hunt" | "captures";
    onClose: () => void;
    onPlay: (kind: MiniGameKind) => void;
    onExplore: (x: number) => void;
    onInitiation: () => void;
}) {
    const uiLocale = useLocale();
    const dialog = useRef<HTMLDialogElement>(null);
    const [tab, setTab] = useState<"journey" | "games" | "hunt" | "captures">(initialTab);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null;
        const node = dialog.current;
        node?.showModal();
        return () => {
            node?.close();
            previous?.focus();
        };
    }, []);
    return (<dialog ref={dialog} className="adventure-menu" aria-labelledby="adventure-title" onKeyDown={(event) => event.stopPropagation()} onCancel={(event) => {
            // The meetup editor is a nested native dialog and owns its own Escape.
            if (event.target !== event.currentTarget)
                return;
            event.preventDefault();
            onClose();
        }}>
      <header>
        <small>{name}{tr(" · carnet de voyage", undefined, uiLocale)}</small>
        <h2 id="adventure-title">
          {tr(tab === "journey"
            ? "L’aventure t’attend"
            : tab === "games"
                ? "Quêtes"
                : tab === "captures" ? "Mes dossiers classés" : "Objets perdus", undefined, uiLocale)}
        </h2>
        <button type="button" aria-label={tr("Fermer le carnet", undefined, uiLocale)} onClick={onClose}>
          ×
        </button>
      </header>
      <div className="adventure-menu__tabs" role="group" aria-label={tr("Pages du carnet", undefined, uiLocale)}>
        <button type="button" aria-pressed={tab === "journey"} onClick={() => setTab("journey")}>{tr("Personnage ", undefined, uiLocale)}</button>
        <button type="button" aria-pressed={tab === "games"} onClick={() => setTab("games")}>{tr("Quêtes ", undefined, uiLocale)}</button>
        <button type="button" aria-pressed={tab === "captures"} onClick={() => setTab("captures")}>{tr("Captures · ", undefined, uiLocale)}{new Set(encounters.filter(e => e.status === "captured").map(e => e.monster)).size}/7</button>
        <button type="button" aria-pressed={tab === "hunt"} onClick={() => setTab("hunt")}>{tr("Objets perdus · ", undefined, uiLocale)}{foundIds.length}/{HIDDEN_ITEMS.length}
        </button>
      </div>
      {tab === "journey" ? (<div className="adventure-menu__profile">
          <div className="journal-hero"><CharacterPortrait character={characterById(characterId)} interactive/><div><small>{tr("Ton compagnon de route", undefined, uiLocale)}</small><h3>{tr(characterById(characterId).name, undefined, uiLocale)}</h3><p>{tr(characterById(characterId).blurb, undefined, uiLocale)}</p></div></div>
          <button className="adventure-menu__profile-link" type="button" onClick={() => setTab("games")}>{tr("Les quêtes de traverse ", undefined, uiLocale)}<span>{tr("12 défis à découvrir →", undefined, uiLocale)}</span>
          </button>
          <button className="adventure-menu__profile-link" type="button" onClick={() => setTab("captures")}>{tr("Mes dossiers classés ", undefined, uiLocale)}<span>{tr("Rencontres sauvages et chômageballs →", undefined, uiLocale)}</span></button>
          {children}
        </div>) : tab === "games" ? (<>
          <p className="adventure-menu__intro">{tr("Entraîne-toi sans modifier ton score ", undefined, uiLocale)}</p>
          <button className="adventure-menu__initiation" type="button" onClick={onInitiation}>
            <UiIcon name="dragon"/><div>{tr("Les rites d’initiation ", undefined, uiLocale)}<small>{tr("Apprendre à jouer", undefined, uiLocale)}</small></div>
          </button>
          <div className="adventure-menu__games">
            {PLAYABLE_MINI_GAMES.map((game) => (<button key={game.kind} type="button" onClick={() => onPlay(game.kind)}>
                <GameArtwork kind={game.kind} className="adventure-menu__game-icon"/>
                <div>
                  <strong>{tr(game.title, undefined, uiLocale)}</strong>
                  <small>{tr(game.misery, undefined, uiLocale)}</small>
                </div>
                <b aria-hidden="true">↗</b>
              </button>))}
          </div>
        </>) : tab === "captures" ? <CaptureCollection encounters={encounters}/> : (<>
          <p className="adventure-menu__intro">{tr("Clique sur les objets cachés dans le décor pour les collectionner ", undefined, uiLocale)}</p>
          <div className="adventure-menu__collection">
            {HIDDEN_ITEMS.map((item) => {
                const found = foundIds.includes(item.id);
                const biome = BIOMES.find((biome) => biome.id === item.biome)!;
                return (<article key={item.id} data-found={found}>
                  <span className="adventure-menu__relic" aria-hidden="true">
                    {found ? (<RelicArtwork src={item.art}/>) : ("?")}
                  </span>
                  <div>
                    <small>{tr(hiddenBiomeLabel(item), undefined, uiLocale)}</small>
                    <h3>{tr(found ? item.name : "Objet caché", undefined, uiLocale)}</h3>
                    {!found ? (<details>
                        <summary>{tr("Un indice ?", undefined, uiLocale)}</summary>
                        <p>{tr(item.clue, undefined, uiLocale)}</p>
                      </details>) : null}
                    {!found ? (<button type="button" onClick={() => onExplore((biome.from + 0.018) * WORLD_LENGTH)}>{tr("Explorer → ", undefined, uiLocale)}</button>) : (<b>{tr("Retrouvé ✓", undefined, uiLocale)}</b>)}
                  </div>
                </article>);
            })}
          </div>
          {foundIds.length === HIDDEN_ITEMS.length ? (<p className="adventure-menu__complete">{tr("Collection complète !", undefined, uiLocale)}</p>) : null}
        </>)}
      <footer>
        <button type="button" onClick={onClose}>{tr("Retour au voyage ", undefined, uiLocale)}</button>
      </footer>
    </dialog>);
}
