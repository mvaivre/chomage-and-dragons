# Décor vivant et interactions

Ajout du 1 octobre 2026.

## Rencontres

| Biome | Habitants au sol | Plan intermédiaire |
| --- | --- | --- |
| Plaine | Poules et troll | Esprits |
| Forêt | Trolls, arbres habités | Esprits hors des bâtiments |
| Marais | Crapauds et fantômes | Esprits et corbeaux |
| Lac | Crapauds et gnomes | Esprits et corbeaux |
| Cascades | Esprits et crapauds | Esprits et corbeaux |
| Montagne | Trolls et fantômes | Esprits et corbeaux |
| Désert | Squelettes et trolls | Esprits et corbeaux |
| Taverne | Gnomes et poules | Esprits et corbeaux |

Les trolls se promènent, s’arrêtent pour répondre, puis reprennent leur marche. Les arbres secouent leur couronne en gardant leurs racines au sol : écureuil bondissant, esprits en mouvement, feuilles. Les corbeaux emportent des feuilles de CV. Les crapauds bondissent et font des ronds dans l’eau. Les poules perdent leurs plumes, les gnomes sautillent et trinquent, les fantômes se matérialisent et les squelettes réagissent à leur bureau.

Les répliques tournent entre trois ou quatre phrases par habitant. Cette nouveauté ne modifie pas le catalogue de panneaux ni les noms des personnages encore en discussion.

## Panneaux fixés aux troncs — 2 octobre 2026

Les légendes de forêt utilisent désormais un panneau de bois avec quatre clous et une ombre de contact. Le texte est composé dans la même texture que les planches, à l’intérieur d’une zone dégagée ; le sprite de 94 × 48 unités se place sur le tronc. Contrôle visuel à 1280×720, 390×844 et 1920×900 : bois et clous visibles, texte lisible sans débordement et racines au contact. Captures : `docs/tree-sign-previews/`.

Asset : `public/art/world-v3/runtime/tree-notice-board.webp`. Généré avec l’outil ImageGen intégré et la référence `forest-oak.webp`, puis uniquement recadré sur sa transparence, réduit à 768 px de large et converti en WebP avec Sharp. Source conservée : `/Users/mika/.codex/generated_images/01a0f857-9351-71e1-9fca-d726ac59efaa/exec-4e9b0e5b-331e-4f1c-ba77-74c4533dbc39.png`.

Prompt exact :

```text
Use case: stylized-concept. Production prop sprite for the hand-drawn medieval 2D game in the reference. A SINGLE small wooden NOTICE BOARD designed to be nailed directly flat onto a tree trunk. Two fitted horizontal weathered oak planks, warm pale honey wood, subtly irregular edges, thick dark handmade ink outline, crisp gouache wood grain. Four small dark iron nails with distinct heads near the corners visibly fasten the board. Shallow dark contact shadow hugging the bottom and right edge, no large floating shadow. Wide rectangular board roughly 2.1:1. The middle 75 percent of the board is quiet, pale and completely BLANK for readable lettering added by the game. No letters, no text, no symbol, no post, no feet, no stand, no tree, no rope, no foliage, no character, no landscape. Straight-on front view with only very slight handmade skew. Entire object complete, centered with generous transparent margins. Match the reference oak's earthy hand-drawn linework and texture. This is one physical attached signboard, not a UI panel.
```

## Règles

- La proximité dépend du vrai personnage de cet appareil : 320 unités autour du domicile de la rencontre. Explorer avec la caméra ou suivre un autre joueur dans le classement ne débloque aucun clic.
- Interactions bloquées pendant son trajet, dans les bâtiments ou lorsqu’une fenêtre de jeu suspend la scène. Aucun score, événement serveur ou progression n’est créé par ces clics.
- Petits boutons transparents placés sur les sprites, avec repère discret, nom accessible et activation au clavier. Les plus petits disposent d’une zone d’au moins 44 pixels.
- Glisser sur un habitant déplace la caméra. Un mouvement de plus de huit pixels annule l’activation ; annulation du pointeur et perte de capture libèrent le déplacement.
- Une seule bulle à la fois, fermeture manuelle ou après 4,5 secondes. Elle suit son habitant et se place sur le côté si l’interface supérieure laisserait trop peu de place au-dessus.
- Les réactions durent 3,6 secondes avec un délai anti-spam de 900 ms. Les habitants éloignés sont démontés par secteurs et les sprites hors champ sont masqués.
- Dessin et clics partagent la même projection de parallax. Les effets sont convertis dans le plan du monde. Les silhouettes restent derrière les joueurs, sans nouveau décor opaque devant leur corps.
- Mouvement réduit : silhouettes fixes, changement de pose lisible et particules limitées. Les paramètres audio existants s’appliquent aux nouveaux sons.

Le panneau DEV ajoute « Rencontre de test » et « Tester les interactions ici ». Il permet d’inspecter les rencontres sans modifier les pas d’un joueur. Le contournement de proximité est uniquement disponible en développement.

## Validation visuelle

Correction du 2 octobre 2026 : les chênes passent après le sol, toujours derrière les héros ; leurs racines chevauchent le bord arrière du chemin de 30 unités. La branche procédurale sous les écureuils est supprimée. Leurs pieds sont ancrés sur la branche peinte près du pixel source (620, 450), avec une hauteur de 38 unités et un petit bond qui revient à cette position.

L’interface supérieure est compactée : portrait de 40 px, carte de voyage limitée à 600 px, classement de 240 px et commandes plus courtes. La zone voyage + commandes mesure 131 px à 1280×720, contre environ 250 px avant correction. Les commandes mobiles conservent 44 px de hauteur. Validation dans le vrai jeu à 1280×720, 390×844 et 1920×900 : racines au contact, écureuils sur les branches, absence de barre, personnages lisibles et aucun débordement horizontal mobile. Ouverture du classement et de sa carte vérifiée ; clic sur un tronc : bulle « On dormait. Bordel. ». Le mode de test des interactions est ensuite désactivé. Captures : `docs/forest-ui-previews/`.

La forêt a été réalisée et validée avant l’extension : 1280×720, 390×844 et 1920×900. Racines fixes, habitants nets, pas de bandes opaques supplémentaires, héros devant le décor. Le premier essai a révélé un chevauchement des clics entre troll et arbre : les domiciles sont désormais au milieu des intervalles entre les troncs et la marche est limitée à 60 unités.

Les autres familles ont été inspectées dans le vrai jeu, biome par biome. Le vol des corbeaux a été abaissé pour rester lisible sous l’interface. Une bulle latérale garde le visage des grands habitants visible sur ordinateur.

Vérifications manuelles : arbre et troll sur mobile, activation au clavier, glissement sur troll sans dialogue, verrouillage après déplacement libre de la caméra, poule et troll accessibles au vrai personnage sans mode DEV, interactions de corbeaux dans le plan de parallax. Le score est resté inchangé pendant ces rencontres.

Captures : [forêt mobile](environment-previews/forest-mobile.png), [forêt large](environment-previews/forest-wide.png), [troll et bulle finale](environment-previews/troll-final.png), [corbeau et bulle finale](environment-previews/parallax-crow-final.png), autres biomes dans `environment-previews/`.

Contrôles automatisés : proximité et états bloquants, placements des huit biomes sur trois tours, dégagement des bâtiments et des arbres, dialogues, transparence et marges des atlases, disposition des bulles. Suite complète : 76 tests. TypeScript, ESLint des fichiers concernés et compilation de production.

## Images et provenance

Deux atlases générés avec l’outil intégré **ImageGen**, fond transparent, référence de style `public/art/world-v3/decor/npc-hype.webp`. Aucun paysage existant n’a été régénéré. Sharp a uniquement recadré les silhouettes complètes, aligné leurs marges et converti les images en WebP. Les autres habitants réutilisent les atlases existants.

- [Troll](../public/art/world-v3/animations/environment-troll.webp) et [métadonnées](../public/art/world-v3/animations/environment-troll.json) : 4×2 cellules de 512 pixels, ligne de base 476, hauteur de référence 440.
- [Écureuils et esprits](../public/art/world-v3/animations/woodland-life.webp) et [métadonnées](../public/art/world-v3/animations/woodland-life.json) : 4×2 cellules de 512 pixels, ligne de base 476, hauteur de référence 400. Recadrage par silhouette entière pour conserver les queues dépassant légèrement la grille de l’image source.

Sources locales ImageGen :

- `/Users/mika/.codex/generated_images/01a0f857-9351-71e1-9fca-d726ac59efaa/exec-7468a1d3-bb26-4ca8-bb4f-7edcb3ee2dde.png`
- `/Users/mika/.codex/generated_images/01a0f857-9351-71e1-9fca-d726ac59efaa/exec-df143118-1827-4fc2-be26-18938f3be9fa.png`

### Prompts utilisés

#### trollLife

Use case: stylized-concept. Asset type: production 2D side-scrolling game character sprite atlas. Reference image is ONLY for its hand-drawn thick ink outlines, muted earthy gouache and textured paper shading. Create ONE grumpy forest troll, olive moss-green skin, big bulbous nose, tiny heavy-lidded eyes, lank hair, protruding teeth, patched brown waistcoat and ragged trousers, oversized bare feet. Comically arrogant petty bureaucrat attitude. Exactly FOUR columns TWO rows, eight equal square cells, ideally 2048x1024. Same full-body troll, identical character scale and feet baseline in all eight cells, facing RIGHT, generous transparent gutters. Row one: 1 idle slouch with arms down, 2 walking left leg forward, 3 walking passing pose, 4 walking right leg forward. Row two: 5 startled, 6 dismissive palm out with disgust, 7 waving somebody away while sneering, 8 arms folded smug refusal. No humans, no text, no objects, no scene, no ground/shadow underneath, no grid lines, no cropping. True transparent background. Whole troll including feet and gesture must fit every cell. Bold expressive silhouettes, crisp detailed line work, matching the reference game.

#### woodlandLife

Use case: stylized-concept. Asset type: production small woodland residents sprite atlas for a 2D side-scrolling game. Reference image is ONLY for bold black hand-drawn ink outlines, muted gouache colours and fine paper-textured shading, not for subject. Exact FOUR columns TWO rows, eight equal square cells ideally total 2048x1024, real transparent background and ample transparent gutters. Row one contains the SAME mischievous russet squirrel with expressive half-closed eyes and large curled bushy tail, facing RIGHT: 1 perched sitting idle, 2 munching an acorn, 3 startled with tail up, 4 full-body leaping to the right with legs stretched. Row two contains the SAME small pale mint-blue woodland spirit with leafy ear tufts, dark oval eyes, tiny arms and tapering wispy tail: 5 quietly floating, 6 eyes wide startled, 7 spinning/dancing, 8 laughing arms up. Each row has a consistent character scale, aligned bottom baseline, full complete silhouettes. No scenes, no background haze, no rectangular glows, no labels, no shadows underneath, no text, no other creatures. Small restrained translucent rim around the spirit is fine, outside silhouette is transparent. Appealing slightly sarcastic fantasy residents, highly readable when shown small in a tree.
