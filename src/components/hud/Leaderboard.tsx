"use client";
import { t as tr } from "@/lib/i18n/index";
import { useLocale } from "@/lib/i18n/react";

import { useMemo, useState } from "react";
import type { Crown, PlayerView } from "@/hooks/useGame";
import { SEASON } from "@/lib/config";
import type { ActionKind } from "@/lib/data/types";
import { monthLabel } from "@/lib/game/calendar";
import { characterById, type Character } from "@/lib/game/characters";
import { ACTION_LABELS, ACTION_ORDER, type Standing } from "@/lib/game/standings";
import {
  ActionArtwork,
  ChestArtwork,
  CrownArtwork,
  PowerArtwork,
} from "./Artwork";
import { ScrollIcon } from "./icons";

/**
 * Les classements.
 *
 * Deux niveaux de lecture : un bandeau compact toujours posé sur la scène, qui donne
 * l'essentiel d'un coup d'œil, et un parchemin déplié pour tout le reste. Séparer les
 * deux évite d'avoir en permanence un tableau de bord devant le jeu.
 */

interface Row {
  rank: number;
  player: PlayerView;
  steps: number;
  counts: Record<ActionKind, number>;
}

function ShotTally({ count, compact = false }: { count: number; compact?: boolean ;
}) {
  const uiLocale = useLocale();
    return (
    <span
      className={`shot-tally ${compact ? "shot-tally--compact" : ""}`} aria-label={tr("{0} shot{1} à boire", [count, count > 1 ? "s" : ""], uiLocale)} title={tr("{0} shot{1} à boire", [count, count > 1 ? "s" : ""], uiLocale)}>
      <PowerArtwork kind="shot" className="shot-tally__art"/>
      <span>{count}</span>
    </span>);
}
function toRows(standings: Standing[], players: PlayerView[]): Row[] {
    const byId = new Map(players.map((p) => [p.id, p]));
    return standings
        .map((standing) => ({
        standing,
        player: byId.get(standing.playerId),
    }))
        .filter((entry): entry is {
        standing: Standing;
        player: PlayerView;
    } => Boolean(entry.player))
        .map((entry, index) => ({
        rank: index + 1,
        player: entry.player,
        steps: entry.standing.steps,
        counts: entry.standing.counts,
    }));
}
/* ------------------------------------------------------------------ compact */
/** « de septembre », « d’avril » : the month without its year. */
interface CompactProps {
    players: PlayerView[];
    monthStandings: Standing[];
    monthKeyNow: string;
    meId: string | null;
    observedId: string | null;
    onLocate: (id: string) => void;
    onOpen: () => void;
}
/** Le bandeau posé en haut à droite : la couronne du mois en jeu. */
export function CompactLeaderboard({ players, monthStandings, monthKeyNow, meId, observedId, onLocate, onOpen, }: CompactProps) {
    const uiLocale = useLocale();
    const rows = useMemo(() => toRows(monthStandings, players), [monthStandings, players]);
    const top = rows.slice(0, 3);
    const mine = rows.find((row) => row.player.id === meId);
    const meOutside = mine && mine.rank > 3 ? mine : null;
    return (<section className="leaderboard-card pointer-events-auto text-left" aria-label={tr("Classement du mois", undefined, uiLocale)}>
      <button type="button" onClick={onOpen} className="leaderboard-card__mobile" aria-label={tr("Ouvrir le classement détaillé et la carte", undefined, uiLocale)} title={tr("Classement et carte", undefined, uiLocale)}>
        <CrownArtwork className="leaderboard-crown-art"/>
      </button>

      <div className="leaderboard-card__desktop">
        <header className="flex items-center justify-between gap-3">
          <h2>{tr("Couronne de {0}", [monthLabel(monthKeyNow)], uiLocale)}</h2>
          <CrownArtwork className="leaderboard-crown-art"/>
        </header>

        {top.length === 0 ? (<p className="py-3 text-sm text-parchment-ink/55 italic">{tr("Le trône attend son premier exploit. ", undefined, uiLocale)}</p>) : (<ul className="mt-2 grid gap-1.5">
            {top.map((row) => (<CompactRow key={row.player.id} row={row} isMe={row.player.id === meId} selected={row.player.id === observedId} onLocate={onLocate}/>))}
            {meOutside ? <CompactRow row={meOutside} isMe selected={meOutside.player.id === observedId} onLocate={onLocate}/> : null}
          </ul>)}
        <button type="button" className="leaderboard-open" onClick={onOpen} aria-label={tr("Ouvrir le classement détaillé et la carte", undefined, uiLocale)}>
          <ScrollIcon />{tr(" Classement & carte ", undefined, uiLocale)}</button>
      </div>
    </section>);
}
function CompactRow({ row, isMe, selected, onLocate }: {
    row: Row;
    isMe: boolean;
    selected: boolean;
    onLocate: (id: string) => void;
}) {
    const uiLocale = useLocale();
    return (
    // The row's own text names it, rank and steps included; only the action is added.
    <li><button type="button" className={`leaderboard-row ${isMe ? "leaderboard-row--me" : ""}`} onClick={() => onLocate(row.player.id)} aria-current={selected ? "true" : undefined} data-selected={selected} title={tr("Voir {0} dans le monde", [row.player.name], uiLocale)}>
      <span className="leaderboard-row__rank">
        {row.rank}
      </span>
      <span className="min-w-0 flex-1 truncate font-semibold text-parchment-ink">
        {row.player.name}
      </span>
      <ShotTally count={row.player.shotsOwed} compact/>
      <span className="font-display text-xl text-parchment-ink">{row.steps}{tr(" pas", undefined, uiLocale)}</span>
      <span className="sr-only">{tr(", voir dans le monde", undefined, uiLocale)}</span>
    </button></li>);
}
/* ------------------------------------------------------------------ déplié */
type Tab = "saison" | "mois" | "palmares";
const TABS: Array<{
    id: Tab;
    label: string;
}> = [
    { id: "mois", label: "Ce mois" },
    { id: "saison", label: "Saison" },
    { id: "palmares", label: "Palmarès" },
];
interface OverlayProps {
    players: PlayerView[];
    seasonStandings: Standing[];
    monthStandings: Standing[];
    monthKeyNow: string;
    crowns: Crown[];
    totals: {
        counts: Record<ActionKind, number>;
        steps: number;
        total: number;
    };
    freeCharacters: Character[];
    meId: string | null;
    /** The group's name and invitation link; both null when the device plays alone. */
    groupName?: string | null;
    inviteUrl?: string | null;
    /** The company's painted map, first thing in the standings. */
    map?: React.ReactNode;
    /** Enrolling others from one device only makes sense in solo mode: null in a group. */
    onAddPlayer: ((name: string, characterId: string) => void) | null;
    onRemovePlayer: (id: string) => void;
    onChangeIdentity: () => void;
    onClose: () => void;
    onLocate: (id: string) => void;
}
export function LeaderboardOverlay({ players, seasonStandings, monthStandings, monthKeyNow, crowns, totals, freeCharacters, meId, groupName = null, inviteUrl = null, map = null, onAddPlayer, onRemovePlayer, onChangeIdentity, onClose, onLocate, }: OverlayProps) {
    const uiLocale = useLocale();
    const [tab, setTab] = useState<Tab>("mois");
    const rows = useMemo(() => toRows(tab === "mois" ? monthStandings : seasonStandings, players), [tab, monthStandings, seasonStandings, players]);
    return (<div className="leaderboard-overlay absolute inset-0 z-30 flex items-start justify-center overflow-y-auto p-3 sm:p-8" onClick={onClose}>
      <div className="scroll-sheet leaderboard-sheet rise w-full max-w-4xl p-5 sm:p-9" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-parchment-ink/45 uppercase">
              {tr(SEASON.label, undefined, uiLocale)}
            </p>
            <h2 className="font-display text-4xl leading-none text-parchment-ink">{tr("La tablée des braves ", undefined, uiLocale)}</h2>
            <p className="mt-2 text-base text-parchment-ink/60">{tr("Les pas, les couronnes et la compagnie. ", undefined, uiLocale)}</p>
          </div>
          <button type="button" onClick={onClose} className="leaderboard-close">{tr("Fermer ", undefined, uiLocale)}</button>
        </header>

        {map ? <section className="leaderboard-map mt-5" aria-label={tr("Carte de la compagnie", undefined, uiLocale)}>{tr(map, undefined, uiLocale)}</section> : null}

        <nav className="leaderboard-tabs mt-6 flex gap-1 border-b border-parchment-ink/20">
          {TABS.map(({ id, label }) => (<button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id} className={`-mb-px border-b-2 px-4 py-3 text-sm font-bold transition-colors sm:px-6 ${
                tab === id
                  ? "border-gold text-parchment-ink"
                  : "border-transparent text-parchment-ink/45 hover:text-parchment-ink/75"
              }`}>
              {tr(label, undefined, uiLocale)}
            </button>))}
        </nav>

        <div className="mt-5">
          {tab === "mois" ? (<div className="monthly-prize">
              <CrownArtwork className="monthly-crown-art"/>
              <div>
                <strong>{tr("La récompense de ", undefined, uiLocale)}{tr(monthLabel(monthKeyNow), undefined, uiLocale)}</strong>
                <span>{tr("Le premier gagne un verre.", undefined, uiLocale)}</span>
              </div>
            </div>) : null}
          {tab === "palmares" ? (<Palmares crowns={crowns} players={players}/>) : (<Standings rows={rows} onLocate={onLocate} meId={meId} caption={tab === "mois"
                ? `Remis à zéro le 1er — ${monthLabel(monthKeyNow)}`
                : "Cumul depuis le début de la saison"}/>)}
        </div>

        <Collective totals={totals} playerCount={players.length}/>

        <Company players={players} freeCharacters={freeCharacters} meId={meId} groupName={groupName} inviteUrl={inviteUrl} onAddPlayer={onAddPlayer} onRemovePlayer={onRemovePlayer} onChangeIdentity={onChangeIdentity}/>
      </div>
    </div>);
}
/* ------------------------------------------------------------------ tableaux */
function Standings({ rows, meId, caption, onLocate, }: {
    rows: Row[];
    meId: string | null;
    caption: string;
    onLocate: (id: string) => void;
}) {
    const uiLocale = useLocale();
    if (rows.length === 0) {
        return (<p className="py-6 text-center text-sm text-parchment-ink/55 italic">{tr("Aucune âme en peine dans la partie. ", undefined, uiLocale)}</p>);
    }
    return (<div>
      <p className="mb-3 text-sm font-semibold text-parchment-ink/55 capitalize">{tr(caption, undefined, uiLocale)}{tr(" · pas parcourus", undefined, uiLocale)}</p>
      <ul className="grid gap-2">
        {rows.map((row) => {
            const character = characterById(row.player.characterId);
            const isMe = row.player.id === meId;
            return (<li key={row.player.id}><button type="button" onClick={() => onLocate(row.player.id)} title={tr("Voir {0} dans le monde", [row.player.name], uiLocale)} className={`standing-row ${
                isMe ? "standing-row--me" : ""
              }`}>
              <span className="standing-row__rank">
                {row.rank === 1 ? (<CrownArtwork className="standing-crown-art"/>) : (row.rank)}
              </span>

              <span className="standing-row__identity min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate font-display text-xl text-parchment-ink">
                    {row.player.name}
                  </span>
                  {row.player.hiredAt ? (<span className="shrink-0 text-[0.62rem] tracking-widest text-moss uppercase">{tr("engagé·e ", undefined, uiLocale)}</span>) : null}
                </span>
                <span className="block truncate text-sm text-parchment-ink/55">
                  {tr(character.name, undefined, uiLocale)}{tr(" — niveau ", undefined, uiLocale)}{row.player.level}
                </span>
              </span>

              <span className="standing-row__counts hidden shrink-0 items-center gap-3 sm:flex">
                {ACTION_ORDER.map((kind) => {
                    return (<span key={kind} title={tr(ACTION_LABELS[kind], undefined, uiLocale)} className="flex w-9 items-center gap-1 text-parchment-ink/60">
                      <ActionArtwork kind={kind} className="standing-action-art"/>
                      <span className="text-xs">{row.counts[kind]}</span>
                    </span>);
                })}
              </span>

              <ShotTally count={row.player.shotsOwed}/>

              <span className="standing-row__steps w-16 shrink-0 text-right text-parchment-ink">
                <strong className="block font-display text-2xl leading-none">{row.steps}</strong>
                <small className="text-xs text-parchment-ink/45">{tr("pas", undefined, uiLocale)}</small>
              </span>
              <span className="sr-only">{tr(", voir dans le monde", undefined, uiLocale)}</span>
            </button></li>);
        })}
      </ul>
    </div>);
}
function Palmares({ crowns, players, }: {
    crowns: Crown[];
    players: PlayerView[];
}) {
    const uiLocale = useLocale();
    const byId = new Map(players.map((p) => [p.id, p]));
    return (<div>
      <p className="mb-2 text-xs text-parchment-ink/55">{tr("Une couronne par mois. Compteurs à zéro le 1er. ", undefined, uiLocale)}</p>
      <ul className="flex flex-col">
        {crowns.map((crown) => {
            const winner = crown.playerId ? byId.get(crown.playerId) : null;
            return (<li key={crown.monthKey} className="flex items-center gap-3 border-b border-parchment-ink/10 py-2.5">
              <span className="w-32 shrink-0 font-display text-sm text-parchment-ink/75 capitalize">
                {tr(monthLabel(crown.monthKey), undefined, uiLocale)}
              </span>
              <span className="standing-row__identity min-w-0 flex-1">
                {winner ? (<span className="flex items-center gap-2">
                    <CrownArtwork className="palmares-crown-art"/>
                    <span className="truncate text-parchment-ink">{winner.name}</span>
                  </span>) : (<span className="text-sm text-parchment-ink/45 italic">
                    {tr(crown.tied ? "Égalité, pas de couronne" : "Mois sans exploit", undefined, uiLocale)}
                  </span>)}
              </span>
              <span className="shrink-0 font-display text-base text-parchment-ink/70">
                {tr(crown.steps > 0 ? `${crown.steps} pas` : "—", undefined, uiLocale)}
              </span>
            </li>);
        })}
      </ul>
    </div>);
}
/* ------------------------------------------------------------------ collectif */
function Collective({ totals, playerCount, }: {
    totals: {
        counts: Record<ActionKind, number>;
        steps: number;
        total: number;
    };
    playerCount: number;
}) {
    const uiLocale = useLocale();
    return (<section className="mt-7 border-t border-parchment-ink/20 pt-5">
      <h3 className="font-display text-sm tracking-widest text-parchment-ink/80 uppercase">{tr("Œuvre de la compagnie ", undefined, uiLocale)}</h3>
      <p className="mt-1 text-xs text-parchment-ink/55">
        {playerCount}{tr(" âme", undefined, uiLocale)}{tr(playerCount === 1 ? "" : "s", undefined, uiLocale)}{tr(" en peine, ", undefined, uiLocale)}{totals.total}{" "}{tr("action", undefined, uiLocale)}{tr(totals.total === 1 ? "" : "s", undefined, uiLocale)}{tr(" déclarée ", undefined, uiLocale)}{tr(totals.total === 1 ? "" : "s", undefined, uiLocale)}, {totals.steps}{tr(" pas au total. ", undefined, uiLocale)}</p>

      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {ACTION_ORDER.map((kind) => {
            return (<li key={kind} className="border border-parchment-ink/15 bg-parchment/40 px-3 py-2">
              <span className="flex items-center gap-1.5 text-parchment-ink/60">
                <ActionArtwork kind={kind} className="collective-action-art"/>
                <span className="text-[0.62rem] tracking-wide uppercase">
                  {tr(ACTION_LABELS[kind], undefined, uiLocale)}
                </span>
              </span>
              <span className="mt-0.5 block font-display text-2xl text-parchment-ink">
                {totals.counts[kind]}
              </span>
            </li>);
        })}
      </ul>
    </section>);
}
/* ------------------------------------------------------------------ compagnie */
function Company({ players, freeCharacters, meId, groupName, inviteUrl, onAddPlayer, onRemovePlayer, onChangeIdentity, }: {
    players: PlayerView[];
    freeCharacters: Character[];
    meId: string | null;
    groupName: string | null;
    inviteUrl: string | null;
    onAddPlayer: ((name: string, characterId: string) => void) | null;
    onRemovePlayer: (id: string) => void;
    onChangeIdentity: () => void;
}) {
    const uiLocale = useLocale();
    const [name, setName] = useState("");
    const [characterId, setCharacterId] = useState(freeCharacters[0]?.id ?? "");
    const [copied, setCopied] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const shared = onAddPlayer === null;
    const ready = name.trim().length > 0 && characterId !== "";
    const submit = () => {
        if (!ready || !onAddPlayer)
            return;
        onAddPlayer(name, characterId);
        setName("");
        setCharacterId(freeCharacters.find((c) => c.id !== characterId)?.id ?? "");
    };
    const copyInvite = async () => {
        if (!inviteUrl)
            return;
        try {
            await navigator.clipboard.writeText(inviteUrl);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        }
        catch {
            window.prompt("Copie ce lien :", inviteUrl);
        }
    };
    return (<section className="mt-7 border-t border-parchment-ink/20 pt-5">
      <h3 className="font-display text-sm tracking-widest text-parchment-ink/80 uppercase">
        {groupName ? `La compagnie · ${groupName}` : "La compagnie"}
      </h3>

      {shared && inviteUrl ? (<div className="mt-3 border border-parchment-ink/20 bg-parchment/40 p-3 text-sm">
          <p className="text-[0.62rem] tracking-widest text-parchment-ink/55 uppercase">{tr("Lien d’invitation", undefined, uiLocale)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate text-xs text-parchment-ink/70" title={tr(inviteUrl, undefined, uiLocale)}>{tr(inviteUrl, undefined, uiLocale)}</code>
            <button type="button" onClick={() => void copyInvite()} className="border border-parchment-ink/30 bg-parchment-ink/8 px-3 py-1.5 font-display text-xs tracking-widest text-parchment-ink transition-colors hover:bg-parchment-ink/15">
              {tr(copied ? "Copié !" : "Copier le lien", undefined, uiLocale)}
            </button>
          </div>
        </div>) : null}

      <ul className="mt-3 flex flex-wrap gap-2">
        {players.map((player) => (<li key={player.id} className="flex items-center gap-2 border border-parchment-ink/15 bg-parchment/40 px-2.5 py-1.5 text-sm">
            <span className="text-parchment-ink">{player.name}</span>
            {player.id === meId ? (<span className="text-[0.6rem] tracking-widest text-gold uppercase">{tr("toi ", undefined, uiLocale)}</span>) : null}
            {!shared || player.id === meId ? (<button type="button" onClick={() => {
                    if (!shared) {
                        onRemovePlayer(player.id);
                        return;
                    }
                    if (leaving)
                        onRemovePlayer(player.id);
                    else
                        setLeaving(true);
                }} aria-label={shared ? (leaving ? "Confirmer mon départ, avec tout mon journal" : "Quitter la partie") : `Retirer ${player.name} de la partie`} title={tr(shared ? "Quitter la partie, avec tout ton journal" : "Retirer de la partie, avec tout son journal", undefined, uiLocale)} className={shared ? "border border-blood/40 px-2 py-0.5 text-[0.65rem] tracking-widest text-blood uppercase" : "text-parchment-ink/35 transition-colors hover:text-blood"}>
                {tr(shared ? (leaving ? "Confirmer ?" : "Quitter") : "×", undefined, uiLocale)}
              </button>) : null}
          </li>))}
      </ul>

      {shared ? null : freeCharacters.length > 0 ? (<div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="min-w-40 flex-1">
            <span className="block text-[0.62rem] tracking-widest text-parchment-ink/55 uppercase">{tr("Nom ", undefined, uiLocale)}</span>
            <input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => {
                if (event.key === "Enter")
                    submit();
            }} maxLength={18} placeholder={tr("Un·e camarade de galère", undefined, uiLocale)} className="mt-1 w-full border border-parchment-ink/25 bg-parchment/70 px-2.5 py-1.5 text-sm text-parchment-ink outline-none placeholder:text-parchment-ink/35 focus:border-gold"/>
          </label>

          <label className="min-w-44">
            <span className="block text-[0.62rem] tracking-widest text-parchment-ink/55 uppercase">{tr("Classe ", undefined, uiLocale)}</span>
            <select value={characterId} onChange={(event) => setCharacterId(event.target.value)} className="mt-1 w-full border border-parchment-ink/25 bg-parchment/70 px-2.5 py-1.5 text-sm text-parchment-ink outline-none focus:border-gold">
              {freeCharacters.map((character) => (<option key={character.id} value={character.id}>
                  {tr(character.name, undefined, uiLocale)}
                </option>))}
            </select>
          </label>

          <button type="button" onClick={submit} disabled={!ready} className="border border-parchment-ink/30 bg-parchment-ink/8 px-4 py-1.5 font-display text-xs tracking-widest text-parchment-ink transition-colors hover:bg-parchment-ink/15 disabled:opacity-40">{tr("Enrôler ", undefined, uiLocale)}</button>
        </div>) : (<p className="mt-3 text-xs text-parchment-ink/50 italic">{tr("Les quinze classes sont prises. ", undefined, uiLocale)}</p>)}

      <div className="mt-5 flex items-center gap-2 text-xs text-parchment-ink/55">
        <ChestArtwork className="company-chest-art"/>
        <span>{tr("10 pas = 1 butin.", undefined, uiLocale)}</span>
        <button type="button" onClick={onChangeIdentity} className="ml-auto border border-parchment-ink/25 px-3 py-1.5 font-display text-[0.65rem] tracking-widest text-parchment-ink/70 transition-colors hover:border-parchment-ink/60 hover:text-parchment-ink">{tr("Ce n’est pas moi ", undefined, uiLocale)}</button>
      </div>
    </section>);
}
