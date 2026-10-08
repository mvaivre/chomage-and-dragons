# Parcours en pas, accueil et scènes intérieures

## Règles

La progression utilise une seule unité, le pas. Candidature : +2 ; refus : +3 ;
entretien : −3 ; rejet après entretien : +6. L’embauche mène à la taverne et conserve
le parcours acquis. Chaque palier de dix pas donne un niveau et un coffre ; un recul
ordinaire ne retire pas un coffre déjà gagné. Les bonus des mini-jeux comptent aussi
au classement. Leurs records de partie restent distincts de la progression ; ils
servent uniquement aux défis, sans créer une seconde monnaie.

Le classement de saison rejoue le même journal que le voyage, avec son plancher à
zéro. Le classement mensuel somme les déplacements effectifs du mois en Europe/Zurich,
en rejouant aussi les événements antérieurs pour connaître la position initiale.
Exemple : départ à 2 pas, entretien (−2 effectifs), puis refus avec bonus (+4) :
4 pas au total, +2 pour le mois. Un mois peut donc afficher un recul net.
Les couronnes, panneaux de couronne et totaux utilisent cette même règle.
Aucun total persistant n’est migré : les sauvegardes locales et de groupe gardent
leurs événements, bonus historiques et butins.

## Accueil et panneaux

Deux panneaux fixes sur le premier tour : « Bienvenue dans la quête du CDI »,
puis « Ici, les refus font avancer ». Le premier est visible dès le départ.
Une fenêtre native `dialog` présente le principe et les quatre déplacements,
les coffres, pouvoirs et défis. Elle apparaît une fois par navigateur, se ferme
avec son bouton ou Échap, isole les raccourcis et se rouvre avec « Aide ».

Les panneaux carton et parchemin utilisent quatre coins mesurés dans `signs.json`.
Les lettres sont dessinées puis déformées sur cette surface une seule fois lors de
la création de la texture. Les enseignes des bâtiments et le distributeur suivent
aussi leur inclinaison. Aucune rasterisation de texte n’est ajoutée au ticker.

## Portes et salles

L’ORP commence plus loin dans la plaine, vers le 11ᵉ pas : de 1600 à 3263,2. L’usine va de
4300 à 5963,2, répétés à chaque tour. Une action reste un seul trajet, avec une seule
allure et un seul atterrissage ; `nextDoor` y repère les seuils. Le héros suivi s’arrête
exactement sur chaque seuil (l’easing de la foulée est inversé pour y reculer le trajet)
pendant le fondu (240 ms vers le noir, tenue de 80 ms, 240 ms de retour ; 120 ms par
fondu en mouvement réduit), puis le même trajet reprend : pas de second recul, pas de
foulée rejouée. Un seul fondu par porte, même si la caméra a vu les pieds passer avant
le seuil, et une seule fin de trajet est annoncée pour l’action. Les autres héros
traversent les portes sans s’arrêter : personne ne regarde leur salle.

Au début du fondu, `renderer.prepare` envoie au GPU, quelques textures par image, l’art
de la destination (`interior:<id>:<from>` ou les calques `outdoors`) : l’image de bascule
n’a plus à tout téléverser d’un coup. À la bascule, la salle est relue sous la position
du héros suivi : un changement de cible pendant le fondu ne montre jamais la mauvaise.

La salle change sous le noir ; le HUD reste au-dessus. Les extérieurs sont masqués
d’un bloc, les murs et sols couvrent toute la fenêtre. Héros et coffres d’un autre
lieu ne sont pas visibles à travers la pièce. Une seule référence décide de ce qui est
montré : `scene.viewedRoom`, la salle du héros tant que la caméra la cadre. Elle est
mesurée à la place du héros à l’écran (`viewedX`, ancre de suivi et glisser compris),
pas au centre de l’écran : un héros au repos près de la sortie reste dans sa salle.
Calques extérieurs, façades, héros, coffres et particules ambiantes la partagent ;
un coffre qui s’ouvre reste visible avec ses étincelles. La sortie retrouve le bâtiment à
gauche ; une marche arrière reprend les mêmes portes. Le rechargement déduit le
lieu depuis la position. Une farce visant un ami dans une autre salle commute aussi
le décor, puis revient au personnage d’origine sans modifier son journal.

Les façades fermées remplacent les anciennes coupes. Les trois nouvelles découpes
ont été produites avec ImageGen intégré, puis importées en WebP avec alpha :
`exterior-orp.webp`, `exterior-factory.webp`, `interior-door.webp` dans
`public/art/world-v3/decor/`. Prompts exacts, sources et commandes :
[scene-door-prompts.json](scene-door-prompts.json). Les 26 WebP de décor occupent
3 649 936 octets depuis leur ré-encodage du 4 octobre (qualité 85, alpha net ;
5 527 554 octets avant), sous le budget de 6 Mo.

## Vérifications

Révision du 25 septembre : ORP repoussé de 600 unités, joueurs et coffres descendus
de 44 unités par rapport au raccord des illustrations. La caméra réserve toujours
la place des noms au-dessus des actions. Captures à jour :
[`docs/decor-previews/lower-path/`](https://github.com/mvaivre/chomage-and-dragons/tree/aeeb109/docs/decor-previews/lower-path/) (départ et ORP, desktop/mobile/large) et
[`docs/decor-previews/lower-path-later/`](https://github.com/mvaivre/chomage-and-dragons/tree/aeeb109/docs/decor-previews/lower-path-later/) (approche, coffre à vingt pas, sortie, usine).
Les treize planches présentant un liseré clair sont retouchées ; voir
[ANIMATION_ASSETS.md](ANIMATION_ASSETS.md).

Les tests unitaires couvrent le recalcul des sauvegardes, les bonus historiques,
les limites de mois à Zurich, le recul net, l’annulation, les égalités et le passage
par chaque porte dans les deux sens sur plusieurs tours. Les tests Chrome/WebGL
exercent accueil, rechargement, marche complète après fondu, annulation, sortie,
retour et observation d’un ami dans une autre salle. Les parcours complets et les
parties à deux appareils sont également rejoués.

Captures de référence dans [`docs/decor-previews/doors-final/`](https://github.com/mvaivre/chomage-and-dragons/tree/aeeb109/docs/decor-previews/doors-final/) : départ, ORP, usine et
sortie, aux formats 390×844, 1280×720 et 1920×1080, de jour et de nuit.
Le contrôle est effectué dans Chrome desktop avec émulation mobile, sans téléphone
physique. La compilation locale utilise `pnpm build --webpack` ; le problème
Turbopack documenté dans `RENDERING.md` reste propre à cet environnement.

Résultats (revue du 4 octobre) : 91 tests unitaires et 21 tests navigateur (parents
inclus), lint, TypeScript et compilation Webpack réussis, tests navigateur en série.
Une sortie à reculons de l’ORP (entretien au pas 12) donnait deux fondus à chaque
essai ; elle n’en donne plus qu’un.

Mesure isolée au pas 14, Chrome/ANGLE Metal sur M1 Max : P95 16,8 ms, maximum
33,4 ms sur 1280×720 ; P95 16,7 ms, maximum 50 ms sur 390×844 avec CPU ×4.
CPU repos observé : 9,70 % et 4,47 %. Ces mesures ponctuelles sur deux compositions
différentes ne sont pas une comparaison de performances entre appareils.
[Données brutes](https://github.com/mvaivre/chomage-and-dragons/blob/aeeb109/docs/decor-previews/doors-perf/results.json).
