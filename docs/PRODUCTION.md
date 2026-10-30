# Production — 30 octobre 2026

Le site de production est [chomage-and-dragons.vercel.app](https://chomage-and-dragons.vercel.app/).
Vercel déploie la branche Git `main`. La mise en production conserve le travail
de la session « Démarrer le projet » : commit `e6e8d6a` (toggle 2D/3D), intégré
à `main` dans `a80daba`. Les deux rendus partagent la même progression.

## Base et conservation

- Projet Neon : `chomage-and-dragons-db` (`cool-darkness-79267033`).
- Branche de production : `main` (`br-still-silence-b271jen5`).
- Tables actives : `public.groups`, `game_states`, `actions`, `device_tokens`, `player_pins`.
- `DATABASE_URL` et `SESSION_SECRET` sont configurés sur Vercel et obligatoires
  à l'exécution en production. Conserver le secret de session entre déploiements.

Les données créées après le lancement sont des données utilisateur à préserver.
Un déploiement ne doit jamais exécuter de reset, seed ou migration destructive.
Les actions normales des joueurs restent soumises aux autorisations du jeu.

## Nettoyage initial effectué

Opération unique autorisée pour les données de préproduction, exécutée et vérifiée
le 30 octobre 2026 vers 18 h 34 (Europe/Zurich). Date limite des groupes concernés :
`2026-10-30T17:24:23Z` (18 h 24 min 23 s à Zurich).

Les cinq anciennes tables ont été déplacées dans le schéma de secours
`prelaunch_archive_20261030`, avec leurs données, contraintes, index et séquences.
Les tables actives ont été recréées vides dans la même transaction. Aucun ancien
groupe n'est exposé par le jeu. Aucune suppression définitive n'a été effectuée.

| Table | Lignes actives après bascule | Lignes conservées dans l'archive |
| --- | ---: | ---: |
| groups | 0 | 3 |
| game_states | 0 | 3 |
| actions | 0 | 159 |
| device_tokens | 0 | 4 |
| player_pins | 0 | 4 |

La transaction a été validée sur PostgreSQL local avant exécution : atomicité,
conservation des données et séquences, refus si un groupe dépasse la date limite,
refus d'une seconde exécution. Les comptages ci-dessus ont ensuite été vérifiés
en lecture seule sur Neon. Aucun script de reset n'est ajouté au dépôt.

Ne pas supprimer cette archive. Elle contient aussi les anciens secrets hachés ;
elle reste dans la base, hors des tables utilisées par l'application. Toute
récupération demande une décision explicite et doit préserver les nouvelles
parties : ne jamais remplacer les tables actives par les anciennes.

## Environnements de test

Les nouvelles previews Vercel créent automatiquement une branche Neon distincte
(option « Create Database Branch For Deployment → Preview » activée au lancement).
La production continue à utiliser la même branche `main` entre les déploiements.
Les previews historiques créées avant ce réglage ne doivent pas servir aux tests :
elles peuvent encore utiliser l'ancienne connexion de production.

En local, laisser `DATABASE_URL` vide pour utiliser la mémoire ou configurer une
base de test indépendante. Pour tester le build de production :

```sh
env -u DATABASE_URL ALLOW_IN_MEMORY_DB=1 SESSION_SECRET=local-browser-tests-only pnpm start --hostname 127.0.0.1 --port 3100
```

Lancer les tests navigateur avec `GAME_TEST_URL=http://localhost:3100`. Les tests
de parcours des groupes refusent les serveurs distants et le serveur qu'ils lancent
eux-mêmes force une base mémoire sans reprendre `DATABASE_URL`.

## Déploiements suivants

Exécuter les tests, le lint et le build, puis publier sur `main`. Vérifier le statut
Vercel et les parcours en lecture seule sur le site. Les tests de création de
groupes, de personnages et d'actions restent en local ou en preview isolée.
Un retour à une version précédente du code conserve la base ; il ne réexécute
jamais le nettoyage initial.
