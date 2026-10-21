# Volcan de la Dernière Épreuve

Le volcan occupe les pas 160 à 174, entre le désert et la taverne. Le trajet reste de 200 pas et les biomes précédents conservent leurs bornes. Le désert est raccourci ; les décors existants, la porte de la taverne et les identifiants des objets déjà collectionnés sont conservés.

Une caldeira en éruption domine deux cascades de lave et un canyon de basalte. Les coulées, projections et braises bougent séparément des illustrations. Les halos du cratère et des chutes, la lueur de l’horizon et les reflets sur la route utilisent les masques lumineux déjà en cache, sans filtre de flou ni nouvelle texture à chaque image. La lave éclaire les plans du canyon même la nuit. L’intensité varie lentement et s’efface aux frontières. Les mouvements réduits figent les effets tout en conservant leur lumière.

Les trois plans illustrés restent derrière le joueur. Une base basse de basalte raccorde les extrémités transparentes du canyon au sol. Dans la caldeira, la brume masque progressivement les paysages voisins et leurs objets collectables ; les cibles invisibles sont également désactivées. Les habitants des autres biomes ne sont pas réutilisés dans le volcan.

Le marteau de forge porte la collection à neuf objets. La lampe du désert est rapprochée des dunes et conserve son identifiant.

## Musique

La musique suit la position réelle du personnage, même quand on explore ailleurs avec la caméra. Les changements gardent les fondus et les positions de lecture existants.

| Lieu | Morceau |
| --- | --- |
| Volcan | Medieval |
| Forêt | Fantasy Worlds — Firelit Tavern |
| Lac, cascades et marais | Medieval City / Tavern Ambient |

Les quatre enregistrements fournis sont conservés sans réencodage. La taverne garde son morceau Firelit Tavern.

## Assets

Création avec l’outil intégré `image_gen`, dans le style à l’encre irrégulière et à la gouache usée du jeu. Sources conservées dans le dossier de génération Codex. Les prompts exacts et chemins des sources figurent dans [VOLCANO_ART_PROMPTS.json](VOLCANO_ART_PROMPTS.json).

- `public/art/world-v3/runtime/volcan-far.webp` : caldeira et panache
- `public/art/world-v3/runtime/volcan-back.webp` : canyon et deux chutes de lave
- `public/art/world-v3/runtime/volcan-mid.webp` : rochers et forge abandonnée
- `public/art/world-v3/runtime/ground-volcan-v2.webp` et `.json` : sol continu avec marge transparente de 24 pixels
- `public/art/world-v3/collectibles/hammer.webp` : marteau à collectionner

L’import reproductible utilise Sharp : `node scripts/compile_volcano_assets.mjs`. Les trois paysages gardent leur résolution et leur transparence. Le sol est recadré, ramené à 2048 × 512 et rendu opaque sous sa marge. Le marteau est réduit à 256 × 256. Les fichiers livrés représentent environ 1,3 Mo.

## Vérification

Les compositions sont inspectées dans le vrai jeu à 1280 × 800, 390 × 844 et 2400 × 900, ainsi qu’aux raccords avec le désert et la taverne. Les tests couvrent les bornes du parcours, la continuité du sol, les fondus et l’intensité de lumière, les anciennes collections, les animations et leur réduction, la lisibilité du joueur, les changements de musique et une sauvegarde inchangée pendant l’exploration.
