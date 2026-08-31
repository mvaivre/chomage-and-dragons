# 🧙 Chômage & Dragons — Donjons & Refus

Jeu web humoristique entre ami·es : **plus on se fait recaler, plus on avance.**
Chaque candidature, chaque refus fait progresser ton personnage sur une carte
d'aventure en 3D. Le 31 décembre, celui ou celle qui a le plus de points est
couronné·e **Légende du Chômage** et se fait inviter à manger par tout le monde.

📖 Les règles complètes : [`docs/PITCH.md`](docs/PITCH.md)
🔧 Les choix techniques et leurs raisons : [`docs/TECH.md`](docs/TECH.md)

## Démarrer

```bash
pnpm install
pnpm dev
```

Puis ouvrir [http://localhost:3000](http://localhost:3000).

## Scripts

| Commande | Effet |
| --- | --- |
| `pnpm dev` | Serveur de développement |
| `pnpm build` | Build de production (ce que Vercel exécute) |
| `pnpm exec tsc --noEmit` | Vérification des types |
| `pnpm exec eslint src` | Lint (`next lint` a été retiré dans Next 16) |

## Pile technique

- **Next.js 16** + **React 19** — hébergé sur **Vercel**
- **Pixi.js 8** via **@pixi/react 8** — la carte d'aventure en 2D
- **Tailwind CSS 4** — l'interface parchemin autour du canvas
- **Neon Postgres** — *pas encore branché*, voir ci-dessous

## Structure

```
src/
  app/                    Routage et styles globaux
  components/
    GameBoardLoader.tsx   ⚠️ Garantit le rendu navigateur-seulement (canvas + stockage local)
    GameBoard.tsx         Assemblage : carte + interface + file d'animations
    race/
      PixiRace.tsx        Application Pixi, mise à l'échelle, tremblement d'écran
      MapScene.tsx        Décor immobile : parchemin, chemin, forêt, marais, pont, taverne
      PlayerToken.tsx     Jeton d'un joueur : bond, électrocution, plaque de nom
      Effects.tsx         Pigeon, éclair, confettis, rejet légendaire, trophée, coffre
      sceneryLayout.ts    Positions du décor, tirées avec une graine fixe
      lanes.ts            Répartition des jetons à égalité
      mapStyle.ts         Palette et styles de texte de la carte
    ui/                   Panneaux parchemin : actions, classements, Scoreboard, joueurs
  hooks/useGame.ts        État du jeu et actions
  lib/
    config.ts             ⚙️ Réglages : saison, points, pondérations
    data/
      types.ts            Joueur et événement
      local-store.ts      ⚠️ SEUL module à remplacer pour passer à Neon
    game/                 Logique pure : score, niveaux, calendrier, classements, chemin
```

Deux fichiers portent l'essentiel des décisions structurantes :

- **`src/lib/config.ts`** — tous les réglages du jeu au même endroit. Changer la date
  de fin de saison ou le barème des points ne demande de toucher à rien d'autre.
- **`src/lib/data/local-store.ts`** — la seule chose qui sait *où* les données sont
  stockées. C'est la couture prévue pour brancher Neon.

## État actuel

Prototype local. Fonctionne :

- la carte d'aventure en 2D sur parchemin, avec ses cinq étapes
  (🌲 Forêt des Candidatures → 🌊 Marais des Refus → 🏔️ Mont du Silence Radio →
  🌉 Pont des Entretiens → 🍻 Taverne du Champion)
- les personnages emoji qui avancent le long du chemin
- **les 5 actions officielles** avec leurs animations : pigeon voyageur 🕊️,
  éclair et personnage électrocuté ⚡😵, confettis et cocktail 🍸,
  LEGENDARY REJECTION 💀, grande célébration 🏆
- l'**annulation** de la dernière action, pour le clic de trop
- les **coffres** 🧰 aux paliers de 10 candidatures
- les **classements** : Saison (Légende du Chômage), Mois (Couronne du mois,
  remise à zéro le 1er) et Palmarès des couronnes passées
- le **Scoreboard collectif** de la compagnie
- l'**ajout et le retrait de joueur·euses** avec choix du personnage
- la palette du feuillage qui suit la saison en cours

Pas encore fait : les événements aléatoires narratifs (chance / mini-boss RH),
et la base de données partagée.

### Limite du prototype

Les données vivent dans le stockage local du navigateur : elles ne sont **pas
partagées** entre joueur·euses, et deux onglets ouverts sur le jeu s'écrasent
mutuellement. C'est acceptable pour valider les mécaniques, pas pour jouer à
plusieurs. Le passage à Neon résout les deux.

## Déploiement

Rien à configurer pour l'instant : le projet est un site Next.js standard, donc
`git push` sur une branche connectée à Vercel suffit. Aucune variable
d'environnement n'est requise tant que la base de données n'est pas branchée.
