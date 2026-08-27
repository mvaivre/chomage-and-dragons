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
      <p className="engrave animate-pulse text-sm">Louchômage &amp; Dragons</p>
    </div>
  ),
});

export function GameLoader() {
  return <Game />;
}
