# Rendu du monde — septembre 2026

La scène active utilise `GameCanvas.tsx`, `FlatWorld.tsx`, `Backdrop.tsx`, `Hero.tsx`
et `textures.ts`. Le chargement Pixi reste exclusivement côté navigateur, via
`GameLoader.tsx`. Les anciennes expériences graphiques et leurs assets restent
disponibles pour comparaison ; leur traitement d'image n'est plus importé par la scène active.

## Profondeur et contact au sol

| Ordre | Couche | Vitesse relative à la caméra |
| --- | --- | --- |
| 1 | Ciel | Position écran, nuages très lents |
| 2 | Paysage lointain | 0,16 |
| 3 | Arrière-plan | 0,36 |
| 4 | Décor derrière les joueurs | 0,76 |
| 5 | Repères de transition, derrière le sol | 1 |
| 6 | Route, coffres, joueurs | 1 |
| 7 | Petites décorations basses au premier plan | 1,12 |
| 8 | Effets temporaires de gameplay | 1 |

Chaque couche utilise la même projection autour du centre de la caméra. Son calcul
sert également à déterminer les biomes à charger : un paysage lointain peut rester
visible plusieurs contrées avant ou après le joueur.

Les sprites de décor sont opaques (`alpha=1`) à l'intérieur de leurs silhouettes ;
leur canal alpha sert au détourage. La profondeur vient de la palette et de la vitesse,
sans rendre les montagnes translucides. Deux silhouettes continues sous les images
évitent les trous entre îlots. Les extrémités du monde prolongent les paysages par miroir.
Les grands repères de transition passent derrière les personnages. Le premier plan
reste bas et peu dense, sans cacher leur corps.

Le niveau de marche est `WALKABLE_GROUND_Y`. Les personnages sont ancrés par les pieds,
avec une ombre de contact, un bond pendant les déplacements et un léger écrasement à
l'atterrissage. La fée conserve son flottement. La route utilise uniquement les tuiles
visibles et une marge ; les répétitions alternées en miroir rendent leurs bords identiques.

## Budget de rendu et durée de vie

- Ciel, nuages, poussières et paysages de base : géométrie créée une fois, déplacements
  et teintes modifiés dans le ticker. La simulation précède la caméra.
- Textures WebP directement chargées par Pixi, sources partagées par URL et images
  d'animation mises en cache. Aucun détourage ni lecture de pixels pendant le jeu.
- Chargement des biomes selon leur projection, avec marge de préchargement ; libération
  des textures huit secondes après leur dernier utilisateur. Les sprites hors écran
  sont masqués, et le héros continue sa progression sans actualiser son dessin hors champ.
- Plafond de 60 images/s et arrêt du ticker quand le document est masqué.
- Framebuffer plafonné à trois millions de pixels, densité au plus 1,5 en largeur mobile
  et 2 ailleurs. Cela borne le coût des écrans Retina et ultralarges.
- Un seul `ResizeObserver` redimensionne le renderer. Les notifications tardives après
  destruction de Pixi sont ignorées. Le portrait de sélection est une image DOM, sans
  second contexte WebGL.

Le panneau de développement affiche FPS, durée p95, nombre de sprites visibles et
mémoire brute estimée des sources actuellement montées (`largeur × hauteur × 4`).
Cette estimation exclut les framebuffers, mipmaps et assets retenus temporairement
dans le cache : ce n'est pas une mesure complète de la mémoire GPU. Le panneau et sa
collecte de statistiques sont absents du build de production.

## Mobile

La caméra utilise une composition de 520 unités de large en portrait, 960 en format
intermédiaire et 1280 en paysage. La hauteur de la barre d'actions est mesurée afin de
garder les pieds et le nom au-dessus de l'interface, y compris après ouverture puis
fermeture de la compagnie. Le viewport dynamique et les marges de sécurité sont pris
en compte. L'interface se compacte en paysage bas ; les libellés d'actions restent lisibles.
Le glisser utilise la capture du pointeur et se termine aussi sur annulation tactile.

## Personnages et compilation des assets

Les quinze fichiers `public/art/world-v3/characters/*.webp` servent aux portraits.
Le jeu utilise leurs déclinaisons animées dans `animations/*.webp`. Ils reprennent les contours noirs irréguliers, couleurs
assourdies, proportions caricaturales et expressions fatiguées de la maquette approuvée.
Le fond proche de la cascade a été repris dans la seconde passe ; les paysages
lointains existants sont conservés.

Provenance locale de génération (ImageGen, session du 6 septembre 2026) :

- Référence de style : `~/.codex/generated_images/01a044db-1343-7071-b056-7ebfef869356/exec-f9074e0e-7b6b-4d42-9e13-36099214e9a3.png`.
- Planche RGBA finale : `~/.codex/generated_images/01a0786c-8dc1-7c72-b64e-f2df416784d9/exec-ff738d99-7b59-4520-ad90-b14bdcbceda9.png`.
- Brief de génération : quinze silhouettes entières en grille 5 × 3, style médiéval
  dessiné à la main volontairement maladroit, contours noirs, aplats mats, sans texte,
  ombre de décor ni arrière-plan ; personnages dans l'ordre des identifiants du script.
  Une seconde passe a produit le vrai canal alpha, le premier essai contenant un damier peint.

Compiler une planche RGBA avec Python et Pillow :

```sh
python3 scripts/prepare_character_atlas.py /chemin/vers/la-planche-rgba.png
```

Le script détecte les quinze silhouettes connexes, garde une marge d'anticrénelage de
deux pixels et exporte en WebP qualité 88. Il ne découpe pas une grille rigide : les
accessoires peuvent dépasser leur cellule. Les PNG de génération restent hors des
ressources chargées par le navigateur. Vérifier le résultat sur un fond uni avant usage.

## Vérifications

```sh
pnpm test
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

Les cinq tests de projection couvrent le centrage, les vitesses relatives, la visibilité
des couches lointaines, la continuité des tuiles aux bords et le budget de pixels aux
densités 1, 2 et 3. `pnpm test` nécessite Node ≥ 22.18 pour importer directement le TypeScript.

La passe visuelle a commencé par la plaine aux formats 1280 × 720, 390 × 844 et
1920 × 900, puis a couvert les sept transitions dans le vrai jeu. Le déplacement après
candidature, sa récompense et l'annulation ont été exercés ; le score et l'historique
initiaux ont été restaurés. Les captures locales sont dans `.codex/visual-qa/` (ignoré par Git).

La version de production a ensuite été contrôlée à 320 × 568, 390 × 844, 844 × 390,
1280 × 720 et 1920 × 900, avec changements de format et aller-retour dans la vue de la
compagnie. Aucune erreur ou alerte console n'a été observée pendant cette vérification.

Les formats mobiles sont des viewports de navigateur desktop. Ils valident la composition,
pas les performances, la température ou la stabilité sur un téléphone physique. Pendant
les observations de développement, le compteur était généralement à 56–59 FPS ; il n'y a
pas de benchmark comparable avant/après permettant d'annoncer un gain chiffré.

## Seconde passe : animation, raccords et interface

Le pilote cascade a été validé en bureau, portrait et panorama avant l’extension aux
quinze personnages et aux huit biomes. Les sprites partagent une échelle et une
ligne de sol par planche : repos/clignement, quatre poses de marche, lettre, réaction,
victoire. Le skater roule et la fée bat des ailes au repos. Les petits habitants derrière
le chemin tamponnent, bâillent, picorent et volent ; six reflets suivent les cascades.
Les atlas sont partagés, sans nouvelle texture à chaque pose.

Les coffres statiques et animés utilisent `JourneyChest` et `chestXForStep`. Le voyage continue au-delà des 80 pas : les paysages se répètent, avec uniquement
les occurrences visibles chargées. La caméra, le sol et les coffres suivent la distance
absolue ; chaque palier de dix pas possède son propre coffre. L’embauche mène à la
prochaine taverne. Son état vidé
reste au même emplacement. Les anciens dessins vectoriels des effets d’action ont
été remplacés par les illustrations communes à l’interface (`lib/game/art.ts`).

`frameComposition` mesure le haut du HUD et le bas des commandes. Il réserve la place
du personnage dans la voie la plus basse et celle de son nom. Le panneau du voyage
utilise des colonnes réductibles et des container queries ; les tablettes ont trois
actions par rangée. Les mots des libellés ne sont plus cassés arbitrairement.

`useSceneTick` garde un abonnement stable et protège le nettoyage après destruction
du ticker. Le problème a été reproduit pendant les remplacements de composants en
mode développement (`Ticker.remove` lisait une liste déjà détruite). Deux tests avec
un vrai ticker couvrent cet ordre de destruction et les priorités héros/caméra/décor.

Les onze tests automatiques passent. Ils couvrent aussi toutes les planches déclarées,
leurs métadonnées, le cadrage et les positions des coffres. La validation des 16 atlas
(personnages + habitants) confirme un contenu opaque, des marges transparentes et
une ligne de sol bornée dans chaque cellule. Les sept raccords ont été inspectés ;
aucune action de la partie sauvegardée n’a été créée pendant cette seconde passe.
Les outils DEV permettent de choisir personnage, pose et effet sans modifier le score.

Les sources, chemins des assets et prompts sont dans [ANIMATION_ASSETS.md](ANIMATION_ASSETS.md).

Le build de production de cette seconde passe a été contrôlé à 320 × 568, 390 × 844,
844 × 390, 900 × 1400 et 1280 × 720, avec retour compagnie → personnage. Aucun
débordement de panneau ou de libellé, ni erreur console n’a été observé dans cet onglet.
Le panorama 1920 × 900 et les effets sans mutation de sauvegarde ont été contrôlés
avec les outils DEV. Les captures de cette passe sont dans `.codex/visual-qa/revision-2/`.


### Parcours prolongé et lisibilité

Barème de voyage : candidature +2, refus +3, entretien −3, rejet post-entretien +6.
Le journal existant est recalculé avec ce barème ; les points restent indépendants.
Les boutons affichent des textes et icônes agrandis ; sur petit écran, le libellé
occupe une ligne complète au-dessus de l’icône et du nombre de pas. Le cadrage tient
compte de l’espace restant entre les commandes, y compris sur écran court.
Tests de régression : distances avant/après 80 et 160 pas, recul, embauche vers la
prochaine taverne, coffres successifs et cadrage mobile.


### Passe de fiabilisation — septembre 2026

- Une action ordinaire déclenche directement sa réaction et son déplacement. Le
  message de gain est annoncé dans une zone de statut ; seuls coffre et embauche
  demandent une validation. Les commandes attendent la fin du mouvement pour éviter
  les séquences superposées. La préparation des sprites bloque les clics prématurés.
- Le journal calcule le maximum de pas atteint pour déterminer les coffres acquis.
  Un entretien ne révoque aucun butin, et repasser un palier n’en crée pas un nouveau.
  Annuler retire l’événement et recalcule ce maximum. La position de retour après
  annulation d’une embauche est animée même si le compteur de pas ne change pas.
- `VisibleHero` ne monte les compagnons éloignés qu’à proximité de la caméra. Le
  cache libère leurs textures après huit secondes sans utilisateur. Le personnage
  local et la cible de caméra restent montés.
- Carte, classement et fenêtres de récompense arrêtent le ticker du jeu. La
  préférence de réduction des mouvements supprime le balancement, les secousses,
  les confettis et les déplacements de caméra interpolés ; les trajets restent
  courts et les interactions gardent leurs confirmations de fin.
- Les pas avancent à vitesse continue. Le skater ne rebondit plus à chaque case.
  Les effets ordinaires restent proches de la main et durent moins d’une seconde.
  Les trajets, coffres et effets utilisent le temps réellement écoulé entre les
  images : un faible débit d’images n’allonge plus leur durée ni le verrouillage
  des commandes. L’arrêt du ticker suspend cette horloge derrière les fenêtres.
- Le cadrage portrait utilise 440 unités de largeur, sous réserve de l’espace libre
  entre HUD et commandes. Le HUD mobile tient en deux lignes ; le feedback s’affiche
  brièvement au-dessus des actions. Le petit format 320 × 568 garde environ 228 px
  de scène disponible dans la partie de test à deux joueurs.
- Les petits décors de sol partagent une ligne d’appui et une ombre. La plaine a été
  inspectée en 1280 × 720, 390 × 844 et 1920 × 900 avant d’appliquer ce placement aux
  autres biomes. Les paysages lointains et les bitmaps approuvés sont conservés.

`pnpm test:browser` rejoue les actions immédiates, les coffres, les reculs, les
annulations, la réduction des mouvements et la fermeture de la carte. Les captures
et les essais Chromium en rendu logiciel valident la composition et le comportement,
pas les FPS, la chauffe ou l’autonomie d’un téléphone physique.
