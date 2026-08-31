# CHÔMAGE & DRAGONS — Décisions techniques

> Journal des choix techniques et de leurs raisons.
> Vérifié en août 2026. Les tiers gratuits changent souvent : revérifier avant de brancher.

## Décisions prises

| Sujet | Décision | Statut |
| --- | --- | --- |
| Hébergement | **Vercel** (plan Hobby, gratuit) | ✅ tranché |
| Base de données | **Neon Postgres** via le Marketplace Vercel | ✅ tranché |
| Framework | **Next.js** + **React** pour l'UI | ✅ tranché |
| Fuseau horaire de référence | **Europe/Zurich** | ✅ tranché |
| Rendu de la carte | **Pixi.js 8** via **@pixi/react 8** (2D) | ✅ tranché |
| ~~Three.js / 3D~~ | Abandonné après prototype — voir plus bas | ❌ écarté |
| Forme des données | **Journal d'événements** (append-only), pas de compteurs | ✅ recommandé |
| Authentification | Code d'accès partagé, pas de comptes | 🔶 à valider |
| Temps réel | Non en v1 (rafraîchissement périodique suffit) | 🔶 à valider |

## Rendu de la carte : Pixi.js 8 (2D)

La Grande Course est une **carte d'aventure en parchemin, dessinée en 2D** avec
Pixi.js. `@pixi/react` v8 permet de décrire la scène en composants React plutôt qu'en
instructions impératives.

> **Pourquoi pas la 3D ?** Un prototype Three.js / react-three-fiber a été construit
> puis abandonné. Il fonctionnait, mais l'esthétique « carte au trésor sur parchemin »
> est mieux servie par du dessin 2D que par un paysage en volume, et la 2D coûte
> beaucoup moins cher en poids et en travail. La leçon est conservée ici pour ne pas
> refaire le débat.

### Versions

`pixi.js` 8.x et `@pixi/react` 8.x. Ce dernier **exige React 19** et fonctionne par
catalogue : on enregistre les classes Pixi avec `extend({ Container, Graphics, Text })`,
puis on les utilise en JSX préfixé (`<pixiContainer>`, `<pixiGraphics>`, `<pixiText>`).
L'ancienne API `<Stage>` de la v7 n'existe plus.

### Règles d'architecture

**1. Les personnages sont des emojis rendus en texte Pixi.**
Aucun asset graphique, aucune dépendance à un graphiste. Ajouter un personnage est une
ligne dans `src/lib/game/characters.ts`.

**2. Seule la carte est en Pixi.** Boutons d'action, Scoreboard, classements et gestion
des joueur·euses sont du React/DOM classique **à côté** du canvas. Construire une
interface dans un canvas est un enfer d'ergonomie et d'accessibilité pour zéro bénéfice.

**3. Tout le décor se dessine avec `Graphics`, pas avec des images.** Sapins, marais,
montagnes, pont et taverne sont des polygones. Le changement de saison ne touche donc
que la palette du feuillage.

**4. Le chemin est une courbe Catmull-Rom 2D** avec table de longueurs cumulées, dans
`src/lib/game/trail.ts`. Positionner quelqu'un à X % du parcours se réduit à
`pointAt(t)`. Sans la table des longueurs, un personnage avancerait par à-coups, plus
vite dans les virages que dans les lignes droites.

**5. Les animations mutent les objets Pixi dans le ticker, jamais via l'état React.**
`useTick` plus des refs : aucune image ne déclenche de re-render. C'est la règle qui
garde le jeu fluide.

**6. Le décor est déterministe.** Positions des sapins tirées avec une graine fixe
(`src/lib/rng.ts`). Avec `Math.random()`, les arbres sauteraient à chaque rendu.

### Pièges rencontrés

- **Pixi a besoin du DOM et du canvas** : le composant doit être chargé uniquement dans
  le navigateur (import dynamique, `ssr: false`), sinon le build Vercel casse.
  Un seul endroit s'en charge : `src/components/GameBoardLoader.tsx`.
- **`<pixiGraphics>` exige la prop `draw`**, même quand on redessine à la main dans le
  ticker via une ref. On lui passe alors un dessin vide.
- **Les noms d'étapes doivent être posés à distance verticale fixe**, pas le long de la
  normale au chemin : la normale change de côté selon l'orientation, ce qui envoyait
  les libellés derrière les montagnes.
- **Les marques de pluriel en JSX** (`action{s}`) produisent des espaces parasites
  quand elles tombent après un retour à la ligne. Construire la chaîne en JavaScript.

## Fuseau horaire : Europe/Zurich

Les bornes de mois et la deadline de fin de saison sont calculées **côté serveur en
Europe/Zurich**, jamais dans le fuseau du navigateur. Sinon la Couronne du mois pourrait
différer selon l'appareil qui affiche le classement — le genre de bug qui ruine une
soirée de remise de prix.

## Pourquoi Vercel + Neon

Point important : **Vercel n'a plus de base de données maison.** Vercel Postgres a été
fermé et les bases migrées chez Neon (qui était déjà la techno sous-jacente). On passe
donc par le **Marketplace** : Vercel provisionne la base et injecte la chaîne de
connexion dans les variables d'environnement du projet.

En pratique c'est une seule expérience : `git push` pour déployer, et on n'ouvre jamais
le tableau de bord de Neon.

**Tier gratuit Neon** (vérifié 08/2026) : permanent, sans carte bancaire, 0,5 Go de
stockage et 100 CU-heures par projet et par mois, mise en veille après 5 min
d'inactivité avec réveil en 100–200 ms.

**Volume estimé du jeu** : ~10 joueurs × ~30 actions/mois × 12 mois ≈ 4 000 lignes,
soit quelques centaines de Ko. On utilise moins d'un millième du tier gratuit.
**Coût total du projet : 0 €.**

## Alternatives évaluées et écartées

| Plateforme | Pourquoi écartée |
| --- | --- |
| **Supabase** | Tier gratuit : **projet mis en pause après 7 jours d'inactivité**. Sur une saison de 12 mois avec des semaines creuses (août, fêtes), on trouverait le jeu hors ligne pile le jour du couronnement. Contournable avec un ping hebdomadaire, mais c'est de la maintenance inutile. |
| **Render** | **Le Postgres gratuit expire ~30 jours après création**, données supprimées après un bref délai de grâce. Rédhibitoire pour un jeu sur 12 mois. En plus : services web endormis après 15 min, 30–60 s de démarrage à froid. |
| **Railway** | Plan gratuit = 1 $ de crédit/mois, insuffisant pour rester en ligne 24/7. Minimum réaliste : 5 $/mois. |
| **Koyeb** | Plus de calcul gratuit depuis 2024. Reste une base de données limitée à 5 h de fonctionnement/mois. |
| **Fly.io** | Plus de tier gratuit pour les nouveaux comptes. |
| **Cloudflare Workers + D1** | **Sérieux challenger** : vrai tout-en-un gratuit, un seul fournisseur, 100 k requêtes/jour, 5 Go. Écarté pour la friction : D1 c'est du SQLite (pas Postgres), et Next.js demande un adaptateur (OpenNext) avec une limite de 10 ms de CPU sur le tier gratuit. Moins de documentation quand ça coince. À reconsidérer si Vercel pose problème. |

## Journal d'événements plutôt que compteurs

**La décision la plus structurante du projet** — la seule qui serait douloureuse à
changer plus tard.

Chaque action est enregistrée comme une ligne immuable (`qui`, `quoi`, `quand`). Les
scores sont **recalculés à la lecture**, jamais stockés comme total.

Ce que ça résout gratuitement :

- **Annulation d'une candidature** cliquée par erreur → retirer/marquer une ligne.
- **Couronne du mois** → filtrer sur un intervalle de dates. Impossible avec des
  compteurs, qui ne savent pas *quand* ils ont été incrémentés.
- **Palmarès des mois passés** → existe sans effort supplémentaire.
- **Fil d'anecdotes** pour l'ambiance.
- **Position sur la course**, qui dépend du temps → recalculable à tout moment.

## Pièges anticipés

1. **Fuseau horaire** — voir plus haut.
2. **Événements aléatoires non déterministes** : s'ils sont tirés au hasard à
   l'affichage, recharger la page relance le tirage et le mini-boss RH disparaît quand
   on veut le montrer. Le tirage doit être **déterministe** (dérivé du joueur + de la
   date) ou **enregistré une seule fois** dans le journal.

## Stratégie de démarrage (à valider)

Version 0 **sans base de données** : données dans le navigateur, déployée sur Vercel dès
le premier jour. Permet d'itérer sur ce qui fait le jeu (le pigeon, l'éclair, le feeling
de la carte) sans qu'une décision de schéma nous ralentisse.

L'accès aux données est isolé derrière une couche dédiée, pour que le basculement vers
Neon ne touche pas l'interface.

**Limite assumée** : les données locales ne sont pas partagées entre joueurs. Valable
pour du prototypage, pas pour le vrai lancement.
