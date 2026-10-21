# La statue des larmes

Une seule femme de pierre monumentale se trouve au bord du chemin dans le décor du lac, à l’emplacement monde `13600`. Son drapé, son diadème et les gravures du socle évoquent une cité atlante, avec les contours irréguliers et la gouache usée du jeu.

La petite fontaine en forme de tête est retirée du plan proche. Les deux anciennes femmes dans le fond sont remplacées par des ruines basses. Le saule, le pont, les berges et le château conservent leur composition. Les paysages lointains et les autres biomes restent inchangés.

Les deux cascades partent des ouvertures près des yeux et tombent dans le bassin sculpté. Les voiles d’eau, reflets descendants, éclaboussures, brume et remous sont animés séparément de la pierre. La géométrie de l’eau se redessine dans son propre groupe de rendu à 30 images par seconde. Les mouvements réduits et le mode logiciel conservent une image fixe ; hors écran, le calcul s’arrête.

Le monument et son eau se dessinent sur la berge, dans le plan du décor qui précède le sol. Le chemin masque le bas du socle ; les coffres et les joueurs passent devant. La statue suit la parallaxe du décor proche et sa taille s’adapte à l’espace entre les contrôles et la berge.

## Fichiers et images

Création et retouches avec l’outil intégré **image_gen**, puis import WebP avec `scripts/compile_ambient_assets.mjs`. Les sources restent dans le dossier de génération Codex. Les prompts exacts et les sources sont dans [TEARS_ART_PROMPTS.json](TEARS_ART_PROMPTS.json).

- `public/art/world-v3/decor/statue-of-tears.webp` et `.json` — sculpture isolée, 1024 × 1536
- `public/art/world-v3/runtime/lac-mid-v2.webp` et `.json` — plan proche sans la petite tête, 960 × 406
- `public/art/world-v3/runtime/lac-back-v2.webp` et `.json` — lac sans les anciennes statues, 1400 × 788
- `src/lib/game/tears.ts` — ancrages des cascades et du bassin
- `src/components/game/StatueOfTears.tsx` — placement et animation

Les images précédentes sont conservées pour comparaison. Les vues avant/après de contrôle se trouvent dans `.qa/tears/` en local, hors Git.

## Vérification

Contrôle du raccord à la berge, de la netteté, des plans et du cadrage dans le vrai jeu sur ordinateur, mobile et écran large. `tests/tears.test.mjs` vérifie que les cascades restent raccordées et se déversent dans le bassin. `tests/browser/tears.test.mjs` vérifie les trois compositions, l’ordre de dessin de la pierre et de l’eau derrière le sol et les coffres, la parallaxe lors du défilement, l’eau en mouvement, la pierre fixe, les mouvements réduits, la sortie du champ et la sauvegarde inchangée.
