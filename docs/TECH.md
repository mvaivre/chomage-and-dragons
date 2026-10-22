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
| Rendu de la carte | **Three.js**, monde voxel procédural | ✅ tranché |
| Forme des données | **Journal d'événements** (append-only), pas de compteurs | ✅ recommandé |
| Authentification | Mot de passe par groupe, sans comptes ; jeton par appareil et PIN par personnage | ✅ tranché (09/2026) |
| Temps réel | Non en v1 : sondage toutes les 8 s | ✅ tranché (09/2026) |
| Mutations | Un réducteur pur partagé appareil/serveur (`lib/game/reducer.ts`) | ✅ tranché (09/2026) |
| État d'un groupe | Une valeur JSON versionnée par groupe, écriture conditionnelle sur la version avec relance, journal d'actions append-only | ✅ tranché (09/2026) |
| Accès base | Client HTTP Neon, SQL brut, schéma créé au premier appel ; base mémoire sans `DATABASE_URL` | ✅ tranché (09/2026) |

## Rendu du monde : Three.js et voxels

Le monde, les personnages et les mini-jeux sont reconstruits en géométrie procédurale.
La caméra orthographique tourne librement, le terrain se charge en chunks, et le
relief est indépendant des distances conservées dans les sauvegardes.
Voir [RENDERING.md](RENDERING.md) pour l'architecture et les vérifications.

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
pas et classements sont **recalculés à la lecture**, jamais stockés comme total.

Ce que ça résout gratuitement :

- **Annulation d'une candidature** cliquée par erreur → retirer/marquer une ligne.
- **Couronne du mois** → rejouer le journal avec le plancher à zéro, puis sommer
  les déplacements effectifs du mois (bonus compris). Impossible avec des
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

## Pièges rencontrés avec les groupes

- En production, Next regroupe les route handlers et les pages dans des bundles
  distincts : un singleton au niveau d'un module existe donc en plusieurs exemplaires.
  La base mémoire et le secret de session de secours vivent sur `globalThis`.
- Le client HTTP de Neon n'offre pas de transaction interactive : pas de `SELECT … FOR
  UPDATE`. L'écriture conditionnelle `UPDATE … WHERE version = $n` avec relance sur
  l'état frais rend le même service, sans WebSocket.
- Le `next-route-announcer` porte un `role="alert"` vide : les tests ciblent les
  alertes de leurs formulaires.

## Stratégie de démarrage (à valider)

Version 0 **sans base de données** : données dans le navigateur, déployée sur Vercel dès
le premier jour. Permet d'itérer sur ce qui fait le jeu (le pigeon, l'éclair, le feeling
de la carte) sans qu'une décision de schéma nous ralentisse.

L'accès aux données est isolé derrière une couche dédiée, pour que le basculement vers
Neon ne touche pas l'interface.

**Limite assumée** : les données locales ne sont pas partagées entre joueurs. Valable
pour du prototypage, pas pour le vrai lancement.
