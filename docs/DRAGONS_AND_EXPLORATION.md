# Dragons, forêt et exploration

## Comportement livré

- Caméra libre à la molette et par glissement, avec retour au personnage. Explorer ne modifie ni les pas ni le biome musical du héros.
- Dragons dans la forêt et la montagne. Le défi ne se déverrouille qu’à moins de 210 unités du nid, une fois la marche terminée. La caméra n’intervient pas dans cette règle.
- « La part du dragon » : trois couloirs, cinq pièces à collecter, trois points d’armure, seize secondes. Entraînement au nid ; une candidature sur trois propose aussi ce défi et sa récompense habituelle.
- Sort du dragon de 6,4 secondes : arrivée, ingestion, digestion, effort, expulsion et départ. La position réelle du héros reste stable ; les transformations visuelles sont nettoyées à la fin et au démontage. Animation réduite respectée.
- Gages, feu, paperasse et déplacements : particules et impacts renforcés. Fenêtre de confirmation du sort supprimée.
- Panneaux réduits ; inscriptions sur certains troncs. Chênes animés derrière les héros. Sol teinté progressivement selon les biomes, avec racines, flaques, neige, sable et planches.
- Cascades agrandies, filets d’eau, brume, jets et ondulations animés sur les deux chutes de l’illustration existante.
- Musique originale synthétisée : introduction au luth, départ en jig avec flûte et percussion, taverne plus rapide. Le morceau YouTube n’est pas intégré.
- Les nouveaux noms et blagues restent dans `TEXTES_A_DISCUTER.md`, conformément à la demande de les choisir ensemble.

## Validation

`pnpm test` : 70 tests réussis. TypeScript, ESLint des fichiers modifiés et `pnpm build --webpack` réussis.

Les tests couvrent notamment les étapes du sort et les huit poses, les nids hors bâtiments, le verrouillage à distance, les contrôles et le score du mini-jeu, quarante graines à trois fréquences d’images, les transitions musicales, l’atlas et son budget.

Contrôles dans le vrai jeu via CUA : forêt à 1280×720, 390×844 et 1920×900 ; cascades desktop/mobile ; transition montagne-désert en grand écran ; pont en bois desktop ; nid inaccessible depuis la caméra ; mini-jeu mobile jusqu’au résultat ; caméra à la molette et retour ; ingestion, digestion, expulsion et restauration du héros. Les captures sont dans `dragon-previews/`.

## Assets générés

Outil intégré `image_gen`, sortie transparente. Aucune API ni CLI de génération utilisée. Sharp a uniquement découpé, aligné, redimensionné et encodé les sorties.

- `public/art/world-v3/animations/dragon.webp` : atlas 2048×1024, huit cellules 512×512, pieds à 476, hauteur de référence 440. Métadonnées dans `dragon.json`.
- `public/art/world-v3/runtime/forest-oak.webp` : 768×1152, tronc et racines ancrés au sol. Alpha vérifié hors silhouette.
- Dragon : référence `ui/power-dragon.webp`, sortie brute `exec-6f268114-6d61-481a-be37-2cc48f1babf8.png`.
- Arbre : référence `runtime/foret-mid.webp`, sortie `exec-fb0c5118-9094-4ff2-91b7-547d89676f58.png`, puis extraction du fond `exec-ae0559ed-dcbf-4c1e-b787-36a72ca744db.png`.
- Sorties brutes conservées dans `/Users/mika/.codex/generated_images/01a0f857-9351-71e1-9fca-d726ac59efaa/`.

## Prompts exacts

### Prompt 1

Use case: stylized-concept. Asset type: 2D game animation sprite sheet. Reference image: style and dragon identity. Create a professional sprite sheet of the SAME comical green dragon with cream belly, plum wing membranes, bold black ink outlines and warm paper-textured gouache shading. TRUE transparent background. Exact uniform grid FOUR columns TWO rows, 8 equal square cells, ideally total 2048x1024. Each cell contains exactly ONE whole dragon, same scale, centred, feet at identical 90% baseline, no clipping, generous margins, no text/numbers/grid lines/shadows behind grid. Side view facing LEFT. Row 1: (1) flying wings high, (2) flying wings low, (3) landed with enormous mouth wide open to swallow a human, (4) jaws shut after swallowing, startled eyes. Row 2: (5) swollen belly, cheeks puffed, (6) straining squat tail lifted (cartoon bathroom gag, no waste/fluids drawn), (7) relieved proud dragon, (8) asleep curled up on ground. Wings/limbs/head must stay readable and consistent. No human or props in any cell. Exaggerate expressions, appealing mischievous tavern-fantasy humour. Dragon fills about 82% of each cell without touching adjacent cells.

### Prompt 2

Use case: stylized-concept. Asset type: isolated tree sprite behind heroes in a side-scrolling game. Reference image is style reference only. Create ONE old oak tree, whole canopy, tall chunky trunk, exposed roots with sparse fern and moss at feet. Warm gouache on paper, bold black hand drawn outlines, matches reference exactly. Genuine transparent background with ample margins, no background glow, no ground rectangle, no scene. Upright front/side view. Dense layered dark olive canopy, crooked branches, thick readable brown trunk; it must feel like a real forest tree. The trunk has ONE small irregular oval patch of peeled pale wood at about 70 percent height from top, suitable for an inscription added later by game code. Patch must be quiet empty smooth wood, no letters, no actual sign/post/board. Trunk under patch and around it stays thick and organic. Vertical image, sharp detail, suitable 600 px tall in game. Keep ground decoration only at roots, low sparse and transparent.

### Prompt 3

Use case: background-extraction. Edit target is this exact tree game sprite. Preserve the oak's full detailed drawing, silhouette, bark, branches, canopy, roots and pale empty bark patch unchanged. Remove ALL coloured background haze, glows and dark or olive cloudy pixels surrounding the silhouette or in the gaps between branches. Output only tree pixels on genuine transparency. No soft aura, no vignette, no background gradient. Keep the whole tree complete including roots. Crisp cutout edges, transparent gaps between branches. Same original framing and aspect ratio.
