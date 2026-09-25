# Brief illustrations — décor « WTF », lots 2 et 3

> Volet illustration de la passe « vie et WTF » de Chômage & Dragons : panneaux,
> figurants, grandes scènes par contrée et passages en intérieur (Centre ORP, Usine à CV).
> Produit avec l'ImageGen intégré de Codex, puis intégré dans le jeu par la même tâche,
> à partir des fichiers et métadonnées décrits ici.

## Règles communes

- **Branche** : celle de la tâche d'ensemble (`codex/decor-wtf`), un commit par groupe
  d'assets, séparé des commits d'intégration.
- **Outil** : ImageGen intégré, comme pour `docs/ambient-prompts.json`. Consigner chaque
  asset (prompt exact, source retenue, sortie, mode d'import) dans un nouveau fichier
  `docs/decor-prompts.json`, même format.
- **Références de style à joindre à chaque génération** :
  `public/art/world-v3/runtime/plaine-mid.webp`, `public/art/world-v3/runtime/foret-back.webp`,
  `public/art/world-v3/animations/gnomes.webp`, `public/art/world-v3/animations/tavern-life.webp`,
  `public/art/world-v3/characters/skater.webp`. Pour les intérieurs, ajouter
  `public/art/world-v3/runtime/taverne-mid-animated.webp`.
- **Style**, à reprendre mot pour mot dans chaque prompt : *Same hand-inked muted
  medieval cartoon artwork as the references: rough wobbly black ink outlines, flat
  muted colours, subtle paper grain, deadpan absurd humour about unemployment and
  job hunting. Sharp game art, clear silhouettes.*
- **Aucun texte peint** : pas de lettres, chiffres ni logos. Là où un texte est prévu
  (panneaux, affiches, écrans, bannières), laisser une **surface vierge, plate, claire,
  face caméra**. Le jeu écrit les textes lui-même, avec sa police.
- **Transparence RGBA réelle** pour tout ce qui n'est pas un fond opaque : pas de damier
  peint, pas de fond coloré, pas d'ombre portée au sol (le jeu dessine ses ombres), pas
  de cadre, légende ni grille.
- **Vue latérale** comme le reste du monde, légère plongée tout au plus. Tout ce qui se
  tient au sol a ses pieds ou sa base sur une même ligne horizontale.
- **Import** : `scripts/compile_ambient_assets.mjs` (mode `atlas` pour les planches
  4 × 2 de 256 × 320, ligne de pieds 312). Pour les autres formats, **étendre ce script**
  avec des paramètres génériques (colonnes, lignes, taille de cellule, ligne de base,
  largeur de sortie, raccord de tuile) plutôt que d'ajouter un script par asset.
  Sorties en WebP qualité 92, sous `public/art/world-v3/decor/`.
- **Métadonnées** : pour chaque planche, un `.json` à côté (colonnes, lignes, taille de
  cellule, ligne de base, hauteurs utiles). Pour chaque surface à texte, un rectangle
  `text: [x, y, largeur, hauteur]` en pixels de cellule, **mesuré sur l'image finale**
  (zone plate et claire, marge de 6 % comprise). Pour chaque pièce animée, son point
  de pivot ou d'accroche.
- **Contrôle** : pour chaque asset, vérifier l'alpha aux bords, l'absence de cellule
  vide ou rognée, l'alignement des bases, et pour les tuiles l'égalité des colonnes de
  bord gauche et droite. Produire une planche-contact PNG de contrôle dans
  `docs/decor-previews/` (non utilisée par le jeu).

## Groupe A — Panneaux vierges (priorité 1)

`public/art/world-v3/decor/signs.webp` + `signs.json` : **4 colonnes × 3 lignes, cellules
384 × 384, base à y = 372**, douze accessoires séparés par de larges gouttières transparentes.

Surfaces à texte vierges, claires (bois clair, parchemin, blanc cassé), bien éclairées,
de face, sans perspective marquée :

1. Poteau indicateur en bois avec trois planches-flèches vierges (gauche, droite, droite).
2. Enseigne suspendue à une potence, panneau vierge.
3. Grand tableau d'affichage sur deux poteaux, trois feuilles de parchemin vierges punaisées.
4. Panneau de danger triangulaire (bord rouge, centre blanc vierge) sur un poteau tordu.
5. Panneau rond d'interdiction (bord rouge, centre blanc vierge) sur un poteau.
6. Avis de recherche en parchemin vierge cloué sur un poteau.
7. Borne kilométrique en pierre, face vierge.
8. Pierre tombale arrondie, face vierge, touffe d'herbe à la base.
9. Croix de tombe en bois, planche transversale vierge.
10. Pancarte de manifestation en carton sur un bâton planté au sol, vierge.
11. Petit panneau d'affichage sur deux poteaux, affiche vierge aux coins déchirés.
12. Chevalet de trottoir en bois (panneau en A), deux faces vierges, vue de trois quarts.

Mesurer et livrer le rectangle `text` de chaque cellule (plusieurs rectangles pour le
poteau à trois flèches et le tableau à trois feuilles).

## Groupe B — Figurants (priorité 2)

Format identique à `animations/gnomes.webp` : **4 × 2 cellules de 256 × 320, pieds sur
une même ligne, tournés vers la droite**, huit poses distinctes, import en mode `atlas`.
Taille des humains comparable aux héros (`characters/*.webp`), sauf mention contraire.

- `npc-hype.webp`
  - Ligne 1 : un **coach en développement personnel** façon gourou médiéval (tunique
    criarde, sourire trop blanc, bandeau). Poses : bras écartés qui harangue ; doigt
    pointé vers le ciel ; pouce levé ; biceps contracté.
  - Ligne 2 : un **influenceur** façon ménestrel-bouffon, tenant un miroir à main comme
    un téléphone. Poses : parle avec les mains ; selfie au miroir ; applaudit ; salue
    en s'inclinant.
- `npc-recruiters.webp`
  - Ligne 1 : un **recruteur caché dans un buisson** (le buisson est toujours là, même
    silhouette). Poses : caché, rien ne dépasse ; seuls les yeux dépassent ; brandit un
    porte-documents ; replonge.
  - Ligne 2 : un **troll des RH** trapu, cravate, badge vierge. Poses : bras croisés ;
    main tendue pour le péage ; secoue la tête « non » ; frappe un tampon sur sa paume.
- `npc-afterlife.webp`
  - Ligne 1 : un **fantôme de recruteur** (drap blanc, cravate, porte-documents), peint
    opaque, le jeu gère la transparence. Poses : flotte ; agite la main ; montre du
    doigt ; se dissipe à moitié (bas du drap effiloché).
  - Ligne 2 : un **squelette assis à un petit bureau** (le bureau fait partie de chaque
    pose). Poses : immobile ; tête penchée ; mâchoire qui tombe ; doigt osseux qui tapote.
- `npc-orp.webp`
  - Ligne 1 : le **guichetier de l'ORP**, en buste derrière un comptoir (le comptoir est
    dans chaque pose, sa base sur la ligne de pieds). Poses : tamponne ; bâille ;
    regarde l'horloge ; fait signe « suivant ».
  - Ligne 2 : une **personne qui attend, assise sur une chaise**, ticket vierge à la main
    (chaise comprise). Poses : attend ; soupire ; dort la tête en arrière ; regarde son
    ticket.
- `npc-factory.webp`
  - Ligne 1 : le **robot trieur de CV**, automate médiéval en laiton avec un monocle-scanner.
    Poses : scanne ; lumière rouge de refus ; tamponne ; au repos.
  - Ligne 2 : un **gobelin ouvrier** fatigué qui enfourne des CV. Poses : porte une pile ;
    enfourne ; s'essuie le front ; s'endort debout.

## Groupe C — Grandes scènes par contrée (priorité 3)

Découpes isolées, transparentes autour, **avec seulement une petite base d'herbe ou de
terre sous l'objet** (pas de sol qui déborde). Largeur source 1536 px (sauf mention),
base de l'objet au bas de l'image. Chaque scène se lit seule, comme un îlot.

1. `setpiece-plaine-scarecrow.webp` — un **épouvantail déguisé en recruteur** (cravate,
   porte-documents) au milieu d'un petit champ où poussent des CV roulés comme des épis.
2. `setpiece-foret-shredder.webp` — un **vieil arbre noueux transformé en broyeuse à CV**
   en bois : trémie pleine de lettres, manivelle, tas de confettis de papier au pied.
   Fournir la manivelle à part (`setpiece-foret-shredder-crank.webp`, 512 × 512,
   pivot au centre de l'axe, noté dans le JSON).
3. `setpiece-marais-bottles.webp` — des **bouteilles à la mer avec des lettres roulées**,
   à moitié enfoncées dans la vase et les roseaux, une mallette de bureau qui s'enfonce.
4. `setpiece-pont-toll.webp` — une **petite guérite de péage** en bois avec une barrière
   rayée levée à moitié et un panneau vierge ; le troll (groupe B) se tiendra à côté.
5. `setpiece-cascade-letters.webp` — **1024 × 1536, portrait** : un éperon rocheux d'où
   tombe une cascade de **lettres de refus** en parchemin au lieu d'eau, avec bassin de
   lettres au pied.
6. `setpiece-montagne-ladder.webp` — **1024 × 1536, portrait** : une **très haute échelle
   de carrière** appuyée contre une falaise, beaucoup de barreaux manquants, une minuscule
   cabane de bureau tout en haut, un panneau vierge au pied.
7. `setpiece-desert-mirage.webp` — un **mirage d'oasis** : deux palmiers, un petit bassin
   et, planté seul dans le sable, un **encadrement de porte de bureau doré** avec sa porte.
8. `setpiece-taverne-afterwork.webp` — une **banderole vierge** tendue entre deux poteaux
   décorés de fanions, un tonneau et deux chopes posées dessus.

## Groupe D — Intérieurs (priorité 4)

Principe : **vue en coupe**, comme une maison de poupée. On ne voit jamais le mur avant :
le héros marche sur un sol intérieur devant un mur du fond. Aucun élément ne passe devant
les personnages. Deux intérieurs, **Centre ORP** puis **Usine à CV**, avec pour chacun :

1. `interior-<nom>-wall.webp` — **mur du fond opaque, 2048 × 1024, raccord horizontal
   parfait** (colonne de gauche identique à celle de droite ; vérifier et corriger par
   décalage d'une demi-largeur puis retouche du raccord). Fenêtres à hauteur d'yeux
   laissant voir un ciel et un paysage flous. Bande basse (y > 860) : plinthe et départ
   du sol.
   - ORP : murs vert pâle institutionnels, tableaux d'affichage vierges, grand écran
     d'appel de numéros vierge, horloge sans chiffres, néons au plafond.
   - Usine : briques, tuyaux, engrenages, bouches de vapeur, tapis roulants en hauteur.
2. `interior-<nom>-floor.webp` — **1672 × 361, même format que
   `runtime/road-universal.webp`**, même ligne de marche, raccord horizontal y compris
   en miroir (le jeu alterne les tuiles en miroir). ORP : carrelage usé en damier ;
   usine : plaques de métal rivetées et planches.
3. `interior-<nom>-ceiling.webp` — **2048 × 256**, raccord horizontal, poutres et lampes
   suspendues ; transparent sous les lampes.
4. `interior-<nom>-facade.webp` — **1536 × 1536** : l'extérieur du bâtiment vu de côté,
   **coupé en deux** sur son côté droit (mur, toit et plancher tranchés proprement,
   intérieur sombre visible), porte ouverte sur le chemin. Le jeu le place à l'entrée et,
   en miroir, à la sortie. Transparent autour.
   - ORP : bâtiment administratif médiéval austère, drapeaux, file d'attente dessinée
     au sol vers la porte ; enseigne vierge.
   - Usine : fabrique en briques, grande cheminée, tuyaux, enseigne vierge.
5. `interior-<nom>-props.webp` + `.json` — **4 × 2 cellules de 512 × 512, base à y = 496**,
   accessoires séparés :
   - ORP : banc d'attente de trois chaises ; distributeur de tickets ; plante en pot
     mourante ; machine à café en laiton « hors service » (surface vierge) ; poteaux de
     file d'attente avec cordon ; fontaine à eau ; pile de dossiers qui menace de tomber ;
     comptoir vitré de guichet vide (le guichetier du groupe B se superposera).
   - Usine : tronçon de tapis roulant vu de côté ; corps de presse à tamponner ; **tête de
     presse seule** (pièce animée, point d'accroche en haut) ; broyeuse ; trémie à CV avec
     tuyau ; caisse de CV ; **roue dentée seule** (pièce animée, pivot au centre) ; levier.

## Livraison

- Un commit par groupe (A, B, C, puis un par intérieur), branche poussée.
- `docs/decor-prompts.json` complet ; planches-contact dans `docs/decor-previews/`.
- Un court récapitulatif dans ce fichier, section « Livré », avec les chemins, tailles
  et toute limite rencontrée (texte parasite, raccord imparfait, pose ratée), pour que
  l'intégration sache quoi corriger.

## Livré

### Illustrations A–D

25 WebP et leurs JSON dans `public/art/world-v3/decor/`, **5 716 692 octets** au total
(plafond : 6 000 000). Chaque sortie possède sa planche-contact PNG dans
`docs/decor-previews/`. Les prompts exacts, références jointes, sources retenues et
commandes d’import sont dans `docs/decor-prompts.json`.

| Groupe | Sorties | Dimensions | Poids WebP |
| --- | --- | --- | ---: |
| A | `signs` | 4 × 3 cellules de 384², base 372 | 459 514 o |
| B | `npc-{hype,recruiters,afterlife,orp,factory}` | 4 × 2 cellules de 256 × 320, base 312 | 1 030 542 o |
| C | 8 `setpiece-*` + manivelle | largeur 1536 ; cascade/échelle 1024 × 1536 ; manivelle 512² | 1 451 018 o |
| D ORP | mur, sol, plafond, façade, accessoires | formats du brief ci-dessus | 1 350 990 o |
| D usine | mur, sol, plafond, façade, accessoires | formats du brief ci-dessus | 1 424 628 o |

Les rectangles de lettrage sont mesurés sur les images finales. Les JSON conservent
les rectangles supplémentaires des trois flèches et des trois feuilles. Les pivots
de la manivelle, de la presse et de la roue sont renseignés. Le script d’import
unique accepte les grilles, bases, dimensions, pivots et raccords génériques.

Limites et traitements :

- L’outil accepte cinq références. Pour les intérieurs, les deux paysages originaux
  sont réunis sans retouche dans `style-landscapes.png` ; les trois autres références
  et la taverne sont jointes séparément. Les six références demandées sont présentes.
- Quelques glyphes de sommeil détachés ont été écartés lors de la séparation des
  îlots. Aucun lettrage de jeu n’est peint dans les images.
- Les tuiles emploient un filtre médian de 3 px, une palette de 12 couleurs et un
  encodage sans perte pour tenir le budget et garder les colonnes de raccord
  strictement identiques après décodage. Leur grain est donc plus discret que celui
  des découpes, encodées en qualité 92. Les bases, gouttières, cellules et raccords
  sont contrôlés automatiquement.

### Intégration des quatre lots

- `src/lib/game/decor.ts` : 86 refus, autres catégories de gags, 43 arrêts par tour,
  espacement de 600 unités, réservations des transitions et intérieurs. Hommages
  aux ami·es, huit refus récents, couronne mensuelle, défi quotidien et engagé·es
  proviennent de l’état du groupe ; les positions restent communes à tous.
- `Decor.tsx`, `DecorNpc.tsx`, `DecorSetpiece.tsx` et `decor-textures.ts` : panneaux
  illustrés avec secours procédural, foule des héros existants, dix figurants,
  huit grandes scènes, réactions de passage, manivelle et mirage. Textes précuits
  avec les polices du jeu, cache partagé et montage limité au champ proche.
- `Interiors.tsx` et `InteriorMask.tsx` : deux salles de onze pas dans la plaine et
  les bois, façades en miroir, sol et plafond, guichet, écran d’appel, machines et
  tapis roulants. Fenêtres liées à l’heure, éclairage intérieur, musique et bannière
  propres. Météo et premier plan extérieur exclus des salles.
- `DecorEvents.tsx` : CV au vent, pigeon de retour, nuage « NON » et enseigne nocturne.
  Les événements rares cèdent la place aux actions ; les mouvements décoratifs
  respectent la préférence de réduction des animations.

Les paysages lointains existants sont conservés. Le protocole, les captures
représentatives et les mesures sont référencés dans `docs/RENDERING.md` et
`docs/decor-previews/README.md`.
