import type { WildEncounter } from "@/lib/data/types";
import { MONSTERS, MONSTER_KINDS, monsterName } from "@/lib/game/encounters";
import { EncounterArtwork } from "./EncounterArtwork";

export function CaptureCollection({ encounters }: { encounters: readonly WildEncounter[] }) {
  const captured = encounters.filter(e => e.status === "captured");
  const species = new Set(captured.map(e => e.monster));
  const ordered = [...MONSTER_KINDS].sort((a,b) => Number(species.has(b)) - Number(species.has(a)));
  return <div className="capture-collection"><p className="adventure-menu__intro">{species.size} / {MONSTER_KINDS.length} espèces · {captured.length} capture{captured.length > 1 ? "s" : ""}</p><p className="capture-collection__intro">Affaiblis les rencontres sauvages, puis lance une chômageball. Tes captures voyagent avec ton personnage.</p>
    <div className="capture-collection__grid">{ordered.map(kind => {
      const matches = captured.filter(e => e.monster === kind), found = matches.length > 0, latest = matches.at(-1), rare = matches.find(e => e.rare);
      return <article key={kind} data-found={found}>
        <div className="capture-collection__art">{found ? <EncounterArtwork model={kind} rare={Boolean(rare)} /> : <span aria-hidden="true">?</span>}</div>
        <div><small>N° {String(MONSTER_KINDS.indexOf(kind) + 1).padStart(2,"0")} {rare ? "· Variante rare ✦" : ""}</small><h3>{found ? rare ? monsterName(rare) : MONSTERS[kind].name : "Rencontre inconnue"}</h3><p>{found ? MONSTERS[kind].description : "Une silhouette attend quelque part sur le chemin…"}</p>
          {latest ? <details><summary>{matches.length} capture{matches.length > 1 ? "s" : ""} · voir le dossier</summary><ul>{matches.slice().reverse().map(e => <li key={e.id}><strong>{monsterName(e)}</strong> · {e.place}<br /><time dateTime={e.capturedAt}>{new Date(e.capturedAt ?? e.at).toLocaleDateString("fr-CH", { timeZone: "Europe/Zurich", day: "numeric", month: "long", year: "numeric" })}</time></li>)}</ul></details> : null}
        </div>
      </article>;
    })}</div>
    {!captured.length ? <p className="capture-collection__empty">Ton premier dossier classé t’attend au fil des déplacements.</p> : null}
  </div>;
}
