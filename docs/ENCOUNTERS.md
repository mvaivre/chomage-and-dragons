# Rencontres sur le chemin

Les déplacements consécutifs aux démarches font apparaître de petits objets voxel près du personnage. Une halte propose son mini-jeu avec deux choix, puis rend la main au même parcours. Un coffre propose la machine à sous à la place du jeu de la démarche ; un coffre gagné en bonus donne son butin sans déclencher une seconde invitation.

Toutes les trois nouvelles démarches (hors embauche), une rencontre sauvage remplace la halte. Le premier cycle fait découvrir les sept espèces : CV froissé, Conseiller ORP, Chaise de bureau, Café de trop, Lettre de refus, Brume du doute et IA du chômage éternel. L’ordre varie par personnage ; une rencontre sur douze environ possède une variante rare. Les rencontres ne modifient ni les pas, ni les pouvoirs, ni les classements.

Une apparition animée montre d’abord l’objet en gros plan, avec silhouette, halo, zoom et effets sonores. Le dialogue et ses choix apparaissent ensuite automatiquement, avec un son distinct. La séquence se passe au clavier ou au toucher et s’adapte à la réduction des mouvements.

Le combat place « TOI » à gauche et « ADVERSAIRE » à droite, chacun avec son nom, son personnage et sa propre jauge. Une ligne courte annonce l’action ; les commandes occupent toute la largeur, sans sous-menu : Argument béton, Relance polie, Souffler, Chômageball et Continuer mon chemin. Les attaques réduisent la résistance sans supprimer la possibilité de capture. Chaque tour montre l’action du joueur, puis la préparation adverse et son projectile, puis l’impact sur le joueur avec les dégâts et la baisse de jauge. Le résultat est sauvegardé avant cette lecture visuelle, qui n’attribue aucun gain supplémentaire. Une grosse attaque adverse est annoncée ; relancer poliment ou souffler amortit le choc. Chaque rencontre offre trois chômageballs. À vingt points de résistance ou moins, la capture est assurée. Une défaite ou une fuite rend la main sans retirer de pas.

Le carnet contient « Captures / Mes dossiers classés » : captures en premier, silhouettes inconnues, variantes rares, nombre d’exemplaires, lieu et date. Les résultats et les tours sont persistés dans `GameState.encounters`, en solo comme dans les groupes. Chaque tour passe par le réducteur partagé ; le serveur vérifie le propriétaire et le numéro du tour, puis calcule lui-même les dégâts et la capture. Un rechargement reprend le combat. Annuler une démarche ne permet pas de retirer une nouvelle rencontre au même ordinal. Les captures déjà acquises restent dans l’album.

Le jeu des mots-clés présente les cinq mots exacts de l’annonce dans un panneau de préparation avant « Lancer le robot ». La pluie reste arrêtée tant que le joueur n’a pas lancé la partie.

« Ne relance pas », l’ancien jeu de chat, n’est plus proposé. Ses types et ses anciennes sauvegardes restent lisibles.

Vérifications : `pnpm test`, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`, puis `GAME_TEST_URL=http://localhost:3100 pnpm test:browser`. Le test `tests/browser/encounters.test.mjs` couvre le parcours réel, la reprise, la capture et l’album sur ordinateur et mobile, ainsi que le nid et la machine. Il produit ses captures d’écran dans `/tmp/louchomage-encounters`.
