# Skateuse et départ de l’aventure — 1 octobre 2026

La classe affichée est désormais « Skateuse des Sans-suite ». Son identifiant
`skater` reste stable pour les personnages et sauvegardes existants. Le portrait
et les seize poses viennent du même dessin ; casquette rouge, lunettes, vêtements
et skateboard gardent le style du jeu. La pose 14 reste écartée par le filtre
existant : l’export comporte un deuxième skateboard dans cette pose de victoire.

Assets intégrés, générés avec l’outil ImageGen intégré puis découpés et encodés
en WebP avec Sharp, sans nouvelle retouche du dessin :

| Asset | Chemin |
| --- | --- |
| Portrait | [skateuse.webp](../public/art/world-v3/characters/skateuse.webp) |
| Animations | [skateuse.webp](../public/art/world-v3/animations/skateuse.webp) |
| Métadonnées | [skateuse.json](../public/art/world-v3/animations/skateuse.json) |

L’atlas utilise les cellules habituelles de 256 × 320 pixels, une ligne de sol à
312 et une hauteur de référence de 265. Les marges transparentes et l’échelle
commune sont conservées. Les anciens assets restent disponibles pour comparaison.

La sélection conserve l’ancien thème doux de la plaine à 84 BPM. Dès qu’une
identité jouable est établie, le moteur démarre la première mesure du thème de
l’aventure, avec un court fondu. La plaine utilise désormais un thème à 116 BPM :
motif de luth, basse, tambour, contretemps et shakers. La nuit garde cette pulsation
et le luth, avec le ralentissement nocturne habituel. Les autres lieux conservent
leurs ambiances. Le bouton du son et la baisse de volume des mini-jeux restent actifs.

Validation : `pnpm test` (65 tests), `pnpm exec tsc --noEmit`, ESLint des fichiers
modifiés. Les tests WebAudio contrôlent le passage intro/aventure, le tempo, la
nuit, le silence, la baisse de volume et les changements de mesure entre lieux.
Les tests d’assets vérifient les marges, le sol et les métadonnées. Contrôle visuel
dans le jeu réel, dont une candidature et son déplacement :

- [Desktop 1280 × 720](skateuse-previews/desktop.png)
- [Mobile 390 × 844](skateuse-previews/mobile.png)
- [Écran large 1920 × 900](skateuse-previews/wide.png)

## Prompt ImageGen final

Image cible : `public/art/world-v3/animations/skater.webp`.
Transparence demandée à l’outil : `transparent_background: true`.

```text
Use case: precise-object-edit. Asset type: production 2D game animation sprite sheet. Edit target: the provided 4-column by 4-row sprite sheet of one male skater. Primary request: replace him with ONE adult woman skateboarder, exactly the same woman in all sixteen poses. Give her a visibly feminine friendly expressive cartoon face, NO beard or stubble, dark brown shoulder-length hair tucked under the same backward red cap with a small ponytail, round glasses, the same baggy distressed dark teal T-shirt with yellow patch, torn baggy shorts, white wristbands, black skate shoes and black/yellow skateboard. Preserve the slightly weary humorous attitude and the original ink outline / muted textured watercolor cartoon style. Keep every original pose, board, hand position, action props (only existing envelopes), feet position, facing RIGHT, and exact grid layout unchanged. Exactly 16 full-body complete separate sprites in equal 4 by 4 cells, same order: row 1 idle eyes open, idle eyes closed, push skating, roll skating; row 2 push skating, roll skating, prepare envelope, hold out envelope; row 3 send/point, recoil surprised, slump, angry foot out; row 4 crouch on board, jump happy on board, triumphant board overhead WITHOUT any extra prop, return to idle. Match the source silhouette size and baseline within each cell, avoid extending any sprite into another cell. Real transparent background and wide empty transparent gutters, NO opaque or semi-transparent matte, NO ground shadows, NO background color, NO checkerboard, NO labels, NO extra characters, NO white borders. Output a crisp high-detail sheet at the source aspect ratio 4:5.
```
