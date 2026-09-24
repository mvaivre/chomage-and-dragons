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
    page.tsx              Accueil : créer un groupe, rejoindre par lien ou code
    g/[slug]/             La partie d'un groupe, et sa page « rejoindre » (mot de passe)
    local/                Mode solo sur cet appareil, sans serveur
    api/groups/           Créer, rejoindre, lire l'état, appliquer une action, reprendre un personnage
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
      Effects.tsx        Moteur des réactions : entrée, impact, sortie, accessoires
      reactions.ts       Chorégraphies des réactions et de leurs variantes
      fx.ts, FxLayer.tsx Particules et éclairs procéduraux, en pool
      AmbientWeather.tsx Météo de chaque contrée
      lanes.ts           Répartition des personnages à égalité
    hud/                  Interface DOM : actions, classements, sélection, récompenses,
                          moment d'action, défi du jour, nouvelles, album
      mini-games/        Un dialogue commun (MiniGameShell), un aiguilleur (MiniGame),
                         puis un composant par jeu et le dessin canvas du pigeon
  hooks/useGame.ts        État du jeu ; chaque mutation passe par le réducteur, sur
                          l'appareil d'abord, puis sur le serveur pour un groupe
  lib/
    config.ts             ⚙️ Réglages : saison, points, pondérations
    data/
      types.ts            Joueur et événement
      store.ts            Contrat du magasin : charger, sauver, réinitialiser
      local-store.ts      Magasin navigateur du mode solo
      remote-store.ts     Client de l'API des groupes, jeton d'appareil compris
      session.ts          Qui joue sur cet appareil, par groupe ; groupes connus
    server/               Côté serveur uniquement
      db.ts               Contrat de base de données : Neon en production, mémoire sinon
      auth.ts             Mots de passe et PIN hachés, jetons d'appareil, cookie signé
      groups.ts           Créer, rejoindre, autoriser et appliquer une action, reprendre
      http.ts             Plomberie des route handlers
    game/                 Logique pure : score, niveaux, calendrier, classements, chemin
      reducer.ts         Toutes les mutations d'une partie, pures et déterministes,
                         partagées entre l'appareil et le serveur
      mini-games.ts      Réservation d'une tentative par action ou par coffre, bonus de pas
      pigeon-flight.ts   Parcours du pigeon : génération, physique, collisions
      keyword-rain.ts    Pluie de mots-clés : annonce, pièges, panier
      stamp-desk.ts      Tapis roulant des preuves de recherches et tampon
      personality-quiz.ts  Banque de questions et distribution par tentative
      ghosting.ts        Quatorze jours de silence : faux « écrit… » et vrai message
      slot-machine.ts    Rouleaux de la machine à sous du coffre
      variants.ts        Les mises en scène de chaque action et leur rareté
      scores.ts          Score de chaque partie, records du groupe
      daily.ts           Défi du jour : un jeu et un parcours par jour de Zurich
      tales.ts           Récits : coups de chance, mini-boss RH, absurdités
      streak.ts          Série hebdomadaire
      daylight.ts        Lumière du jour à Zurich
    client/               Navigateur uniquement : son synthétisé, préchargement, lumière
```

Deux fichiers portent l'essentiel des décisions structurantes :

- **`src/lib/config.ts`** — tous les réglages du jeu au même endroit. Changer la date
  de fin de saison ou le barème des points ne demande de toucher à rien d'autre.
- **`src/lib/data/local-store.ts`** — la seule chose qui sait *où* les données sont
  stockées. C'est la couture prévue pour brancher Neon.

## État actuel

Jouable en groupe d'ami·es, en ligne. Fonctionne :

- huit contrées en parallaxe, de la Plaine de la Poisse à la Taverne du Triomphe,
  reliées par sept lieux de transition
- quinze personnages illustrés, partagés entre le jeu et l'écran de sélection
- un cadrage adapté au bureau, au portrait et au paysage sur mobile
- **les 5 actions officielles**, chacune mise en scène comme un moment : la caméra
  se rapproche, le héros réagit sur place, la réaction le suit, l'impact frappe
  (éclair, flash, secousse, confettis, onde de choc, ralenti), les points volent
  jusqu'à leur compteur, les pas défilent pendant la marche, une bannière annonce
  chaque nouvelle contrée ; tout le son est synthétisé, avec un bouton pour couper
- **dix-neuf mises en scène** tirées selon leur rareté (six sur dix classiques, trois
  rares, une légendaire), identiques pour tout le groupe : l'escadrille de pigeons,
  l'orage, le grand NON, le tapis rouge, la fanfare des gnomes, le météore, le
  crapaud qui lit la lettre, quarante-sept lettres, l'ascension vers la taverne…
- les **récits** du pitch, une action sur huit : coup de chance, mini-boss RH ou
  absurdité du recrutement, purement narratifs
- un **monde vivant** : l'heure réelle de Zurich (aube, soir doré, nuit étoilée),
  la météo de chaque contrée (pollen, feuilles, lucioles, neige, sable, braises),
  des gnomes qui acclament le passage du héros
- des **mini-jeux facultatifs** qui décorent les actions, une seule tentative
  chacun, jamais rejouée après annulation ou rechargement, et qui ne touchent
  qu'aux pas de voyage ou au butin, jamais aux points :
  - candidature : **le pigeon à reculons** (tape pour battre des ailes, dix tours,
    trois plumes) en alternance avec **le CV à mots-clés** (glisse le CV sous les
    mots de l'annonce, évite les fautes de goût), ×2 sur les pas ;
  - refus : **le Tampon de l'ORP**, tamponne dix dossiers de preuves de recherches
    sous l'œil du gnome, +1 pas ;
  - entretien : **le Test de personnalité**, cinq questions, la bonne réponse est
    celle du recruteur, le recul passe de −3 à −2 pas ;
  - rejet après entretien : **Ne relance pas**, quatorze jours de silence, réponds
    au vrai message et jamais aux points de suspension, +2 pas ;
  - coffre : **Salaire selon expérience**, la machine à sous du double fond,
    trois CHF pour un butin de plus.

  Chaque défi arrive en carte d'invitation une fois le moment joué. Chaque partie
  garde un score, le groupe un record par jeu, et un **défi du jour** propose le même
  parcours à toute la compagnie, une fois par jour, avec son classement.
- l'**annulation** de la dernière action, pour le clic de trop
- les **coffres** 🧰 aux paliers de 10 pas
- les **classements** : Saison (Légende du Chômage), Mois (Couronne du mois,
  remise à zéro le 1er) et Palmarès des couronnes passées
- le **Scoreboard collectif** de la compagnie
- l'**ajout et le retrait de joueur·euses** avec choix du personnage
- le ciel et les silhouettes de fond qui suivent la palette du biome
- la **vie du groupe** : les actions des ami·es jouées en direct sur leur héros,
  annoncées par une carte où on les salue en un emoji (👏 🍺 🔥 😂 🫂), et au
  retour un récapitulatif de ce qui s'est passé pendant ton absence
- le **défi du jour** toujours visible dans le HUD : un tap pour jouer, puis le
  classement du jour
- une **série hebdomadaire** 🔥 et un **album** : mises en scène vues, récits vécus,
  contrées traversées, meilleurs scores

Pour revoir une mise en scène ou un moment précis en développement :
`?debug&variant=storm`, `?debug&tale=boss`, `?debug&hour=22` sur l'adresse du jeu.

## Groupes d'ami·es

Un groupe a un nom et un mot de passe. Son lien d'invitation, `/g/<code>/rejoindre`,
se partage ; le mot de passe se transmet de vive voix. Chaque personnage est lié à
l'appareil qui l'a créé par un jeton secret : on ne joue que pour soi. Un code PIN de
4 à 6 chiffres, choisi à la création, permet de reprendre son personnage sur un autre
appareil, ce qui le retire du précédent. Un même appareil peut appartenir à plusieurs
groupes.

L'état d'un groupe vit sur le serveur, en une seule valeur JSON versionnée, plus un
journal des actions. Chaque appareil applique une action localement pour répondre tout
de suite, l'envoie avec les mêmes identifiants, et adopte la réponse du serveur. Un
sondage toutes les huit secondes ramène les actions des autres.

## Déploiement

Le projet est un site Next.js standard : `git push` sur une branche connectée à Vercel
déploie. Deux variables d'environnement, voir `.env.example` :

- `DATABASE_URL`, injectée par l'intégration Neon du Marketplace Vercel. Le schéma est
  créé au premier appel, sans migration à lancer.
- `SESSION_SECRET`, un secret aléatoire qui signe les cookies de session des groupes.

Sans `DATABASE_URL`, les groupes vivent en mémoire et disparaissent avec le processus :
c'est le mode du développement et des tests. Le mode solo, `/local`, ne touche jamais
au serveur.


### Vérification des parcours du jeu

`pnpm test` couvre le barème, la progression et les coffres acquis, la projection et
les sprites, le réducteur des mutations, la couche des groupes sur base mémoire
(mots de passe, jetons, autorisation, écritures concurrentes), ainsi que les mini-jeux : chaque parcours, tapis, pluie de mots ou machine
à sous générés restent gagnables par un pilote automatique à toutes les cadences
d'affichage, et la réservation d'une tentative survit à l'annulation et au rechargement. Les actions retirées du journal par Annuler retirent aussi les gains
qu’elles avaient débloqués ; un entretien ordinaire conserve les coffres acquis.

Pour les tests dans un vrai navigateur :

```sh
pnpm exec playwright install chromium
pnpm build
pnpm test:browser
```

Les tests démarrent leur serveur sur le port 3100 et utilisent des contextes isolés,
sans toucher à la sauvegarde de votre navigateur. `GAME_TEST_URL` permet de choisir
un serveur déjà lancé. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` permet de choisir un
Chromium installé plutôt que celui fourni par Playwright.
