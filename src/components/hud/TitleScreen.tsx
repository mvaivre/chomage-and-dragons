"use client";

import { useMemo, useState } from "react";
import { CharacterPortrait } from "@/components/game/CharacterPortrait";
import type { PlayerView } from "@/hooks/useGame";
import { characterById, type Character } from "@/lib/game/characters";
import { SEASON } from "@/lib/config";
import { CrownArtwork } from "./Artwork";

/**
 * L'écran d'entrée.
 *
 * Deux chemins seulement : reprendre un personnage déjà présent dans la partie, ou
 * en forger un nouveau. Une fois le choix fait, la machine s'en souvient et cet écran
 * ne réapparaît plus — c'est le rôle de la session.
 */

interface TitleScreenProps {
  players: PlayerView[];
  freeCharacters: Character[];
  /** The group's name, when the game is shared. */
  groupName?: string | null;
  /** In a group, a character needs a PIN so its player can reclaim it on another device. */
  requirePin?: boolean;
  /** Something the player should read before choosing, such as a lost character. */
  message?: string | null;
  onPick: (playerId: string) => void;
  onCreate: (name: string, characterId: string, pin?: string) => void;
}

export function TitleScreen({
  players,
  freeCharacters,
  groupName = null,
  requirePin = false,
  message = null,
  onPick,
  onCreate,
}: TitleScreenProps) {
  const [forging, setForging] = useState(players.length === 0);

  return (
    <div className="curtain absolute inset-0 z-30 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col items-center justify-center gap-8 px-6 py-12">
        <header className="rise text-center">
          <p className="engrave text-xs opacity-70">{SEASON.label}</p>
          <h1 className="engrave mt-2 text-4xl leading-[1.15] sm:text-6xl">
            Chômage
            <span className="mx-3 text-gold opacity-80">&</span>
            Dragons
          </h1>
          <div className="gold-rule mx-auto mt-4 w-64" />
          {groupName ? (
            <p className="mt-3 font-display text-xl tracking-wide text-gold-light">{groupName}</p>
          ) : null}
          {message ? (
            <p role="status" className="mx-auto mt-3 max-w-md border border-gold-dim bg-black/40 px-3 py-2 text-sm text-parchment/85">{message}</p>
          ) : null}
          <p className="mt-4 max-w-xl font-body text-base text-parchment/75 italic">
            Chaque tentative te fait avancer. Huit contrées séparent la Plaine de la
            Poisse de la Taverne du Triomphe — même les refus deviennent du terrain gagné.
          </p>
        </header>

        {forging ? (
          <Forge
            freeCharacters={freeCharacters}
            requirePin={requirePin}
            canGoBack={players.length > 0}
            onBack={() => setForging(false)}
            onCreate={onCreate}
          />
        ) : (
          <Roster
            players={players}
            onPick={onPick}
            onForge={() => setForging(true)}
            canForge={freeCharacters.length > 0}
          />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ reprendre */

function Roster({
  players,
  onPick,
  onForge,
  canForge,
}: {
  players: PlayerView[];
  onPick: (id: string) => void;
  onForge: () => void;
  canForge: boolean;
}) {
  const sorted = useMemo(
    () => [...players].sort((a, b) => b.score - a.score),
    [players],
  );

  return (
    <section className="frame riveted rise w-full max-w-2xl p-6">
      <h2 className="engrave text-center text-sm">Qui es-tu ?</h2>
      <div className="gold-rule mx-auto mt-3 mb-5 w-40" />

      <ul className="flex flex-col gap-2">
        {sorted.map((player) => {
          const character = characterById(player.characterId);
          return (
            <li key={player.id}>
              <button
                type="button"
                onClick={() => onPick(player.id)}
                className="slot w-full flex-row! items-center! justify-between! gap-4 px-4 py-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate font-display text-lg tracking-wide text-parchment">
                    {player.name}
                  </span>
                  <span className="block truncate text-sm text-gold-light/70">
                    {character.name}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-4 text-right">
                  <span className="text-xs text-parchment/55">
                    Niveau {player.level}
                  </span>
                  <span className="font-display text-xl text-gold-light">
                    {player.score}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onForge}
        disabled={!canForge}
        className="slot mt-5 w-full flex-row! items-center! justify-center! gap-2 px-4 py-3 font-display text-sm tracking-widest text-gold-light disabled:cursor-not-allowed"
      >
        <CrownArtwork className="h-5 w-5" />
        {canForge ? "Nouvelle âme en peine" : "Toutes les classes sont prises"}
      </button>
    </section>
  );
}

/* ------------------------------------------------------------------ forger */

function Forge({
  freeCharacters,
  requirePin,
  canGoBack,
  onBack,
  onCreate,
}: {
  freeCharacters: Character[];
  requirePin: boolean;
  canGoBack: boolean;
  onBack: () => void;
  onCreate: (name: string, characterId: string, pin?: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");

  const character = freeCharacters[index] ?? null;
  const pinOk = !requirePin || /^\d{4,6}$/.test(pin);
  const ready = name.trim().length > 0 && character !== null && pinOk;
  const create = () => { if (ready && character) onCreate(name, character.id, requirePin ? pin : undefined); };

  const move = (step: number) => {
    if (freeCharacters.length === 0) return;
    setIndex((i) => (i + step + freeCharacters.length) % freeCharacters.length);
  };

  if (!character) {
    return (
      <section className="frame riveted rise w-full max-w-md p-6 text-center">
        <p className="text-sm text-parchment/75">
          Les quinze classes sont déjà incarnées. Il faudra qu’un·e camarade se fasse
          engager pour libérer une place.
        </p>
      </section>
    );
  }

  return (
    <section className="frame riveted rise w-full max-w-2xl p-6">
      <h2 className="engrave text-center text-sm">Forge ton personnage</h2>
      <div className="gold-rule mx-auto mt-3 mb-5 w-40" />

      <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-stretch">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label="Classe précédente"
            className="slot h-11 w-9 font-display text-gold-light"
          >
            ‹
          </button>

          <div className="relative">
            <CharacterPortrait character={character} />
          </div>

          <button
            type="button"
            onClick={() => move(1)}
            aria-label="Classe suivante"
            className="slot h-11 w-9 font-display text-gold-light"
          >
            ›
          </button>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-4">
          <div>
            <p className="font-display text-xl tracking-wide text-gold-light">
              {character.name}
            </p>
            <p className="mt-1 text-sm text-parchment/70 italic">
              {character.blurb}
            </p>
            <p className="mt-2 text-xs text-parchment/45">
              {index + 1} / {freeCharacters.length} classes libres
            </p>
          </div>

          <label className="block">
            <span className="engrave text-[0.65rem] opacity-70">Ton nom</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") create();
              }}
              maxLength={18}
              placeholder="Mika"
              className="mt-1 w-full border border-gold-dim bg-black/45 px-3 py-2 font-display text-lg tracking-wide text-parchment outline-none placeholder:text-parchment/25 focus:border-gold-light"
            />
          </label>

          {requirePin ? (
            <label className="block">
              <span className="engrave text-[0.65rem] opacity-70">Code PIN, 4 à 6 chiffres</span>
              <input
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") create();
                }}
                inputMode="numeric"
                autoComplete="off"
                placeholder="1234"
                className="mt-1 w-full border border-gold-dim bg-black/45 px-3 py-2 font-display text-lg tracking-[0.3em] text-parchment outline-none placeholder:text-parchment/25 focus:border-gold-light"
              />
            </label>
          ) : null}

          <div className="flex gap-2">
            {canGoBack ? (
              <button
                type="button"
                onClick={onBack}
                className="slot px-4 py-2.5 text-xs tracking-widest text-parchment/70"
              >
                Retour
              </button>
            ) : null}
            <button
              type="button"
              onClick={create}
              disabled={!ready}
              className="slot flex-1 px-4 py-2.5 font-display text-sm tracking-widest text-gold-light disabled:cursor-not-allowed"
            >
              Entrer dans la partie
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ reprise */

/** A character from another device: its PIN binds it here and unbinds it there. */
export function ClaimDialog({
  player,
  onSubmit,
  onCancel,
}: {
  player: PlayerView | null;
  onSubmit: (pin: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = /^\d{4,6}$/.test(pin) && !busy;

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(pin);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Le serveur a trébuché.");
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[40] flex items-center justify-center bg-black/70 px-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="claim-title"
        className="frame riveted rise grid w-full max-w-sm gap-3 p-5"
        onSubmit={(event) => { event.preventDefault(); void submit(); }}
      >
        <h2 id="claim-title" className="engrave text-center text-sm">Reprendre {player?.name ?? "ce personnage"}</h2>
        <label className="block">
          <span className="engrave text-[0.65rem] opacity-70">Code PIN</span>
          <input
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            aria-label="Code PIN"
            className="mt-1 w-full border border-gold-dim bg-black/45 px-3 py-2 font-display text-lg tracking-[0.3em] text-parchment outline-none focus:border-gold-light"
          />
        </label>
        {error ? <p role="alert" className="text-sm text-blood">{error}</p> : null}
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="slot px-4 py-2.5 text-xs tracking-widest text-parchment/70">Annuler</button>
          <button type="submit" disabled={!ready} className="slot flex-1 px-4 py-2.5 font-display text-sm tracking-widest text-gold-light disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Vérification…" : "Reprendre"}
          </button>
        </div>
      </form>
    </div>
  );
}
