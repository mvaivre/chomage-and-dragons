# 🧙 Chômage & Dragons — Donjons & Refus

Jeu web humoristique entre ami·es : **plus on se fait recaler, plus on avance.**
Chaque candidature, chaque refus fait progresser ton personnage sur une carte
d'aventure en 2D avec parallaxe. Le 31 décembre, celui ou celle qui a le plus de points est
couronné·e **Légende du Chômage** et se fait inviter à manger par tout le monde.

📖 Les règles complètes : [`docs/PITCH.md`](docs/PITCH.md)
🔧 Les choix techniques et leurs raisons : [`docs/TECH.md`](docs/TECH.md)
🎨 Le rendu actuel, les assets et les vérifications : [`docs/RENDERING.md`](docs/RENDERING.md)

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
| `pnpm lint` | ESLint |
| `pnpm test` | Tests de projection, couverture du sol et budget de pixels (Node ≥ 22.18) |

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
    GameLoader.tsx        Chargement navigateur-seulement (canvas + stockage local)
    Game.tsx              Scène + interface + file d'animations
    game/
      GameCanvas.tsx      Application Pixi, caméra, profondeur, redimensionnement
      FlatWorld.tsx       Décors v3, transitions, route et chargement par zone visible
      Backdrop.tsx        Ciel et nuages à géométrie fixe
      Hero.tsx            Illustrations des joueurs, déplacements et effets
      textures.ts        Cache partagé des textures et des images d'animation
      projection.ts      Projection des couches et budget du framebuffer
      Effects.tsx        Pigeon, éclair, cocktail, trophée, coffre et farces
      lanes.ts           Répartition des personnages à égalité
    hud/                  Interface DOM : actions, classements, sélection, récompenses
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

- huit contrées en parallaxe, de la Plaine de la Poisse à la Taverne du Triomphe,
  reliées par sept lieux de transition
- quinze personnages illustrés, partagés entre le jeu et l'écran de sélection
- un cadrage adapté au bureau, au portrait et au paysage sur mobile
- **les 5 actions officielles** avec leurs animations : pigeon voyageur 🕊️,
  éclair et personnage électrocuté ⚡😵, confettis et cocktail 🍸,
  LEGENDARY REJECTION 💀, grande célébration 🏆
- l'**annulation** de la dernière action, pour le clic de trop
- les **coffres** 🧰 aux paliers de 10 candidatures
- les **classements** : Saison (Légende du Chômage), Mois (Couronne du mois,
  remise à zéro le 1er) et Palmarès des couronnes passées
- le **Scoreboard collectif** de la compagnie
- l'**ajout et le retrait de joueur·euses** avec choix du personnage
- le ciel et les silhouettes de fond qui suivent la palette du biome

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
