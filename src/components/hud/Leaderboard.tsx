"use client";

import { useMemo, useState } from "react";
import type { Crown, PlayerView } from "@/hooks/useGame";
import { SEASON } from "@/lib/config";
import type { ActionKind } from "@/lib/data/types";
import { monthLabel } from "@/lib/game/calendar";
import { characterById, type Character } from "@/lib/game/characters";
import { ACTION_LABELS, ACTION_ORDER, type Standing } from "@/lib/game/standings";
import {
  BoltIcon,
  ChestIcon,
  CrownIcon,
  GobletIcon,
  PigeonIcon,
  ScrollIcon,
  SkullIcon,
  TrophyIcon,
} from "./icons";

/**
 * Les classements.
 *
 * Deux niveaux de lecture : un bandeau compact toujours posé sur la scène, qui donne
 * l'essentiel d'un coup d'œil, et un parchemin déplié pour tout le reste. Séparer les
 * deux évite d'avoir en permanence un tableau de bord devant le jeu.
 */

const ACTION_ICONS: Record<
  ActionKind,
  (props: { className?: string }) => React.ReactElement
> = {
  candidature: PigeonIcon,
  refus: BoltIcon,
  entretien: GobletIcon,
  rejetApresEntretien: SkullIcon,
  embauche: TrophyIcon,
};

const RANK_COLORS = ["text-gold-light", "text-parchment/85", "text-parchment/65"];

interface Row {
  rank: number;
  player: PlayerView;
  score: number;
  counts: Record<ActionKind, number>;
}

function toRows(standings: Standing[], players: PlayerView[]): Row[] {
  const byId = new Map(players.map((p) => [p.id, p]));

  return standings
    .map((standing) => ({
      standing,
      player: byId.get(standing.playerId),
    }))
    .filter((entry): entry is { standing: Standing; player: PlayerView } =>
      Boolean(entry.player),
    )
    .map((entry, index) => ({
      rank: index + 1,
      player: entry.player,
      score: entry.standing.score,
      counts: entry.standing.counts,
    }));
}

/* ------------------------------------------------------------------ compact */

interface CompactProps {
  players: PlayerView[];
  monthStandings: Standing[];
  monthKeyNow: string;
  meId: string | null;
  onOpen: () => void;
}

/** Le bandeau posé en haut à droite : la couronne du mois en jeu. */
export function CompactLeaderboard({
  players,
  monthStandings,
  monthKeyNow,
  meId,
  onOpen,
}: CompactProps) {
  const rows = useMemo(() => toRows(monthStandings, players), [monthStandings, players]);
  const top = rows.slice(0, 3);
  const mine = rows.find((row) => row.player.id === meId);
  const meOutside = mine && mine.rank > 3 ? mine : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="frame riveted pointer-events-auto w-56 p-3 text-left transition-transform hover:-translate-y-0.5"
      aria-label="Ouvrir les classements détaillés"
    >
      <div className="flex items-center gap-1.5">
        <CrownIcon className="h-3.5 w-3.5 text-gold-light" />
        <span className="engrave text-[0.6rem]">Couronne du mois</span>
      </div>
      <p className="mt-0.5 text-[0.62rem] text-parchment/45 capitalize">
        {monthLabel(monthKeyNow)}
      </p>
      <div className="gold-rule my-2" />

      {top.length === 0 ? (
        <p className="text-[0.7rem] text-parchment/50 italic">
          Personne n’a encore marqué.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {top.map((row) => (
            <CompactRow key={row.player.id} row={row} isMe={row.player.id === meId} />
          ))}
          {meOutside ? (
            <>
              <li className="my-0.5 text-center text-[0.6rem] text-parchment/30">···</li>
              <CompactRow row={meOutside} isMe />
            </>
          ) : null}
        </ul>
      )}

      <p className="mt-2 flex items-center justify-center gap-1 text-[0.58rem] text-parchment/40">
        <ScrollIcon className="h-3 w-3" />
        Tout voir — Échap
      </p>
    </button>
  );
}

function CompactRow({ row, isMe }: { row: Row; isMe: boolean }) {
  return (
    <li
      className={`flex items-baseline gap-2 px-1 text-xs ${
        isMe ? "bg-gold/12 -mx-1 rounded-sm px-2" : ""
      }`}
    >
      <span
        className={`w-3 font-display text-[0.7rem] ${
          RANK_COLORS[row.rank - 1] ?? "text-parchment/50"
        }`}
      >
        {row.rank}
      </span>
      <span
        className={`min-w-0 flex-1 truncate ${
          isMe ? "text-parchment" : "text-parchment/75"
        }`}
      >
        {row.player.name}
      </span>
      <span className="font-display text-sm text-gold-light">{row.score}</span>
    </li>
  );
}

/* ------------------------------------------------------------------ déplié */

type Tab = "saison" | "mois" | "palmares";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "saison", label: "Saison" },
  { id: "mois", label: "Ce mois" },
  { id: "palmares", label: "Palmarès" },
];

interface OverlayProps {
  players: PlayerView[];
  seasonStandings: Standing[];
  monthStandings: Standing[];
  monthKeyNow: string;
  crowns: Crown[];
  totals: { counts: Record<ActionKind, number>; score: number; total: number };
  freeCharacters: Character[];
  meId: string | null;
  onAddPlayer: (name: string, characterId: string) => void;
  onRemovePlayer: (id: string) => void;
  onChangeIdentity: () => void;
  onClose: () => void;
}

export function LeaderboardOverlay({
  players,
  seasonStandings,
  monthStandings,
  monthKeyNow,
  crowns,
  totals,
  freeCharacters,
  meId,
  onAddPlayer,
  onRemovePlayer,
  onChangeIdentity,
  onClose,
}: OverlayProps) {
  const [tab, setTab] = useState<Tab>("saison");

  const rows = useMemo(
    () => toRows(tab === "mois" ? monthStandings : seasonStandings, players),
    [tab, monthStandings, seasonStandings, players],
  );

  return (
    <div
      className="absolute inset-0 z-20 flex items-start justify-center overflow-y-auto bg-black/72 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="scroll-sheet rise w-full max-w-3xl p-6 sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl tracking-wide text-parchment-ink">
              Le Grand Registre
            </h2>
            <p className="mt-0.5 text-sm text-parchment-ink/60 italic">
              {SEASON.label} — la Légende du Chômage se joue au 31 décembre.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 border border-parchment-ink/25 px-3 py-1.5 font-display text-xs tracking-widest text-parchment-ink/70 transition-colors hover:border-parchment-ink/60 hover:text-parchment-ink"
          >
            Fermer
          </button>
        </header>

        <nav className="mt-5 flex gap-1 border-b border-parchment-ink/20">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={`-mb-px border-b-2 px-4 py-2 font-display text-xs tracking-widest transition-colors ${
                tab === id
                  ? "border-gold text-parchment-ink"
                  : "border-transparent text-parchment-ink/45 hover:text-parchment-ink/75"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="mt-5">
          {tab === "palmares" ? (
            <Palmares crowns={crowns} players={players} />
          ) : (
            <Standings
              rows={rows}
              meId={meId}
              caption={
                tab === "mois"
                  ? `Remis à zéro le 1er — ${monthLabel(monthKeyNow)}`
                  : "Cumul depuis le début de la saison"
              }
            />
          )}
        </div>

        <Collective totals={totals} playerCount={players.length} />

        <Company
          players={players}
          freeCharacters={freeCharacters}
          meId={meId}
          onAddPlayer={onAddPlayer}
          onRemovePlayer={onRemovePlayer}
          onChangeIdentity={onChangeIdentity}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ tableaux */

function Standings({
  rows,
  meId,
  caption,
}: {
  rows: Row[];
  meId: string | null;
  caption: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-parchment-ink/55 italic">
        Aucune âme en peine dans la partie.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs text-parchment-ink/55 capitalize">{caption}</p>
      <ul className="flex flex-col">
        {rows.map((row) => {
          const character = characterById(row.player.characterId);
          const isMe = row.player.id === meId;

          return (
            <li
              key={row.player.id}
              className={`flex items-center gap-3 border-b border-parchment-ink/10 py-2.5 ${
                isMe ? "-mx-2 bg-gold/12 px-2" : ""
              }`}
            >
              <span className="w-7 shrink-0 text-center font-display text-lg text-parchment-ink/70">
                {row.rank === 1 ? (
                  <CrownIcon className="mx-auto h-5 w-5 text-gold" />
                ) : (
                  row.rank
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate font-display text-base text-parchment-ink">
                    {row.player.name}
                  </span>
                  {row.player.hiredAt ? (
                    <span className="shrink-0 text-[0.62rem] tracking-widest text-moss uppercase">
                      engagé·e
                    </span>
                  ) : null}
                </span>
                <span className="block truncate text-xs text-parchment-ink/55">
                  {character.name} — niveau {row.player.level}
                </span>
              </span>

              <span className="hidden shrink-0 items-center gap-3 sm:flex">
                {ACTION_ORDER.map((kind) => {
                  const Icon = ACTION_ICONS[kind];
                  return (
                    <span
                      key={kind}
                      title={ACTION_LABELS[kind]}
                      className="flex w-9 items-center gap-1 text-parchment-ink/60"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="text-xs">{row.counts[kind]}</span>
                    </span>
                  );
                })}
              </span>

              <span className="w-12 shrink-0 text-right font-display text-xl text-parchment-ink">
                {row.score}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Palmares({
  crowns,
  players,
}: {
  crowns: Crown[];
  players: PlayerView[];
}) {
  const byId = new Map(players.map((p) => [p.id, p]));

  return (
    <div>
      <p className="mb-2 text-xs text-parchment-ink/55">
        Une couronne par mois. Arriver en cours de saison ne coûte donc rien : le mois
        d’arrivée se joue à armes égales.
      </p>
      <ul className="flex flex-col">
        {crowns.map((crown) => {
          const winner = crown.playerId ? byId.get(crown.playerId) : null;

          return (
            <li
              key={crown.monthKey}
              className="flex items-center gap-3 border-b border-parchment-ink/10 py-2.5"
            >
              <span className="w-32 shrink-0 font-display text-sm text-parchment-ink/75 capitalize">
                {monthLabel(crown.monthKey)}
              </span>
              <span className="min-w-0 flex-1">
                {winner ? (
                  <span className="flex items-center gap-2">
                    <CrownIcon className="h-4 w-4 shrink-0 text-gold" />
                    <span className="truncate text-parchment-ink">{winner.name}</span>
                  </span>
                ) : (
                  <span className="text-sm text-parchment-ink/45 italic">
                    {crown.tied ? "Égalité, pas de couronne" : "Mois sans exploit"}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-display text-base text-parchment-ink/70">
                {crown.score > 0 ? crown.score : "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ collectif */

function Collective({
  totals,
  playerCount,
}: {
  totals: { counts: Record<ActionKind, number>; score: number; total: number };
  playerCount: number;
}) {
  return (
    <section className="mt-7 border-t border-parchment-ink/20 pt-5">
      <h3 className="font-display text-sm tracking-widest text-parchment-ink/80 uppercase">
        Œuvre de la compagnie
      </h3>
      <p className="mt-1 text-xs text-parchment-ink/55">
        {playerCount} âme{playerCount === 1 ? "" : "s"} en peine, {totals.total}{" "}
        action{totals.total === 1 ? "" : "s"} déclarée
        {totals.total === 1 ? "" : "s"}, {totals.score} point
        {Math.abs(totals.score) === 1 ? "" : "s"} au total.
      </p>

      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {ACTION_ORDER.map((kind) => {
          const Icon = ACTION_ICONS[kind];
          return (
            <li
              key={kind}
              className="border border-parchment-ink/15 bg-parchment/40 px-3 py-2"
            >
              <span className="flex items-center gap-1.5 text-parchment-ink/60">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-[0.62rem] tracking-wide uppercase">
                  {ACTION_LABELS[kind]}
                </span>
              </span>
              <span className="mt-0.5 block font-display text-2xl text-parchment-ink">
                {totals.counts[kind]}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ compagnie */

function Company({
  players,
  freeCharacters,
  meId,
  onAddPlayer,
  onRemovePlayer,
  onChangeIdentity,
}: {
  players: PlayerView[];
  freeCharacters: Character[];
  meId: string | null;
  onAddPlayer: (name: string, characterId: string) => void;
  onRemovePlayer: (id: string) => void;
  onChangeIdentity: () => void;
}) {
  const [name, setName] = useState("");
  const [characterId, setCharacterId] = useState(freeCharacters[0]?.id ?? "");

  const ready = name.trim().length > 0 && characterId !== "";

  const submit = () => {
    if (!ready) return;
    onAddPlayer(name, characterId);
    setName("");
    setCharacterId(freeCharacters.find((c) => c.id !== characterId)?.id ?? "");
  };

  return (
    <section className="mt-7 border-t border-parchment-ink/20 pt-5">
      <h3 className="font-display text-sm tracking-widest text-parchment-ink/80 uppercase">
        La compagnie
      </h3>

      <ul className="mt-3 flex flex-wrap gap-2">
        {players.map((player) => (
          <li
            key={player.id}
            className="flex items-center gap-2 border border-parchment-ink/15 bg-parchment/40 px-2.5 py-1.5 text-sm"
          >
            <span className="text-parchment-ink">{player.name}</span>
            {player.id === meId ? (
              <span className="text-[0.6rem] tracking-widest text-gold uppercase">
                toi
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => onRemovePlayer(player.id)}
              aria-label={`Retirer ${player.name} de la partie`}
              title="Retirer de la partie, avec tout son journal"
              className="text-parchment-ink/35 transition-colors hover:text-blood"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {freeCharacters.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="min-w-40 flex-1">
            <span className="block text-[0.62rem] tracking-widest text-parchment-ink/55 uppercase">
              Nom
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submit();
              }}
              maxLength={18}
              placeholder="Un·e camarade de galère"
              className="mt-1 w-full border border-parchment-ink/25 bg-parchment/70 px-2.5 py-1.5 text-sm text-parchment-ink outline-none placeholder:text-parchment-ink/35 focus:border-gold"
            />
          </label>

          <label className="min-w-44">
            <span className="block text-[0.62rem] tracking-widest text-parchment-ink/55 uppercase">
              Classe
            </span>
            <select
              value={characterId}
              onChange={(event) => setCharacterId(event.target.value)}
              className="mt-1 w-full border border-parchment-ink/25 bg-parchment/70 px-2.5 py-1.5 text-sm text-parchment-ink outline-none focus:border-gold"
            >
              {freeCharacters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={submit}
            disabled={!ready}
            className="border border-parchment-ink/30 bg-parchment-ink/8 px-4 py-1.5 font-display text-xs tracking-widest text-parchment-ink transition-colors hover:bg-parchment-ink/15 disabled:opacity-40"
          >
            Enrôler
          </button>
        </div>
      ) : (
        <p className="mt-3 text-xs text-parchment-ink/50 italic">
          Les huit classes sont prises.
        </p>
      )}

      <div className="mt-5 flex items-center gap-2 text-xs text-parchment-ink/55">
        <ChestIcon className="h-4 w-4" />
        <span>Un coffre s’ouvre à chaque palier de dix candidatures.</span>
        <button
          type="button"
          onClick={onChangeIdentity}
          className="ml-auto border border-parchment-ink/25 px-3 py-1.5 font-display text-[0.65rem] tracking-widest text-parchment-ink/70 transition-colors hover:border-parchment-ink/60 hover:text-parchment-ink"
        >
          Ce n’est pas moi
        </button>
      </div>
    </section>
  );
}
