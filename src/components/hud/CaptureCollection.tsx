"use client";
import { t as tr, localeTag } from "@/lib/i18n/index";
import { useLocale } from "@/lib/i18n/react";
import type { WildEncounter } from "@/lib/data/types";
import { MONSTERS, MONSTER_KINDS, monsterName } from "@/lib/game/encounters";
import { EncounterArtwork } from "./EncounterArtwork";
export function CaptureCollection({ encounters }: {
    encounters: readonly WildEncounter[];
}) {
    const uiLocale = useLocale();
    const captured = encounters.filter(e => e.status === "captured");
    const species = new Set(captured.map(e => e.monster));
    const ordered = [...MONSTER_KINDS].sort((a, b) => Number(species.has(b)) - Number(species.has(a)));
    return <div className="capture-collection"><p className="adventure-menu__intro">{species.size} / {MONSTER_KINDS.length}{tr(" espèces · ", undefined, uiLocale)}{captured.length}{tr(" capture", undefined, uiLocale)}{tr(captured.length > 1 ? "s" : "", undefined, uiLocale)}</p><p className="capture-collection__intro">{tr("Affaiblis les rencontres sauvages, puis lance une chômageball. Tes captures voyagent avec ton personnage.", undefined, uiLocale)}</p>
    <div className="capture-collection__grid">{ordered.map(kind => {
            const matches = captured.filter(e => e.monster === kind), found = matches.length > 0, latest = matches.at(-1), rare = matches.find(e => e.rare);
            return <article key={kind} data-found={found}>
        <div className="capture-collection__art">{found ? <EncounterArtwork model={kind} rare={Boolean(rare)}/> : <span aria-hidden="true">?</span>}</div>
        <div><small>{tr("N° ", undefined, uiLocale)}{tr(String(MONSTER_KINDS.indexOf(kind) + 1).padStart(2, "0"), undefined, uiLocale)} {tr(rare ? "· Variante rare ✦" : "", undefined, uiLocale)}</small><h3>{tr(found ? rare ? monsterName(rare) : MONSTERS[kind].name : "Rencontre inconnue", undefined, uiLocale)}</h3><p>{tr(found ? MONSTERS[kind].description : "Une silhouette attend quelque part sur le chemin…", undefined, uiLocale)}</p>
          {latest ? <details><summary>{matches.length}{tr(" capture", undefined, uiLocale)}{tr(matches.length > 1 ? "s" : "", undefined, uiLocale)}{tr(" · voir le dossier", undefined, uiLocale)}</summary><ul>{matches.slice().reverse().map(e => <li key={e.id}><strong>{tr(monsterName(e), undefined, uiLocale)}</strong> · {tr(e.place, undefined, uiLocale)}<br /><time dateTime={e.capturedAt}>{tr(new Date(e.capturedAt ?? e.at).toLocaleDateString(localeTag(uiLocale), { timeZone: "Europe/Zurich", day: "numeric", month: "long", year: "numeric" }), undefined, uiLocale)}</time></li>)}</ul></details> : null}
        </div>
      </article>;
        })}</div>
    {!captured.length ? <p className="capture-collection__empty">{tr("Ton premier dossier classé t’attend au fil des déplacements.", undefined, uiLocale)}</p> : null}
  </div>;
}
