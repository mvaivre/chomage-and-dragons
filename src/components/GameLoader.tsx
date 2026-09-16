"use client";

import dynamic from "next/dynamic";

/**
 * Le jeu ne tourne que dans le navigateur : Pixi a besoin d'un canvas, et l'identité
 * du joueur vient du stockage local. Le charger sans rendu serveur évite un premier
 * rendu vide suivi d'un remplacement, et supprime toute question d'hydratation.
 */
const Game = dynamic(() => import("./Game").then((m) => m.Game), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-ink-deep">
      <p className="engrave animate-pulse text-sm">Chômage &amp; Dragons</p>
    </div>
  ),
});

/** `slug` names the group whose game lives on the server; without it, the device plays alone. */
export function GameLoader({ slug = null }: { slug?: string | null }) {
  return <Game slug={slug} />;
}
