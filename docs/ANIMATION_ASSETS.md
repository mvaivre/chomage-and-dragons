# Sprites et animation — seconde passe, septembre 2026

Génération avec l’outil ImageGen intégré, sans CLI ni appel API séparé. Les planches
retenues sont compilées dans le dépôt. Les originaux de génération restent dans
`~/.codex/generated_images/01a0786c-8dc1-7c72-b64e-f2df416784d9/`.

Le jeu charge seulement les personnages présents et les biomes visibles, pas ce catalogue entier.

## Livrables

- `public/art/world-v3/animations/{personnage}.webp` : 15 planches de 16 poses,
  cellules 256 × 320, pieds à y=312 ; fichiers JSON associés pour l’échelle commune.
- `public/art/world-v3/animations/ambient.webp` : poule, corbeau, employé au tampon,
  grenouille ; quatre poses chacun.
- `public/art/world-v3/runtime/ground-props.webp` : huit petits groupes de végétation,
  rochers et objets de sol, un par biome.
- `public/art/world-v3/runtime/cascade-back-v2.webp` : reprise ciblée des berges de la
  cascade, raccords latéraux descendants. Tous les paysages `*-far.webp` sont conservés.
- `public/art/world-v3/runtime/chest-journey.webp` : coffre fermé, entrouvert, lumineux,
  puis vidé. La pose 3 du fichier source n’est pas utilisée : son couvercle était absent.

Les prompts communs et les variantes disponibles sont conservés dans
[`animation-prompts.json`](animation-prompts.json). Les premiers briefs spécifiques :
voleur à capuche verte ; skater en vêtements bleus et casquette rouge avec vraie poussée,
roulement et ollie ; fée verte avec battements d’ailes ; chevalier gris au plumet rouge.
Chaque personnage reprend son identité de `characters/{id}.webp`. La planche du voleur
sert de référence de disposition pour les premières variantes. Les suivantes utilisent
uniquement leur identité afin d’éviter de reprendre les accessoires du voleur.

Brief des habitants : petites silhouettes dans le même dessin, poule qui picore et marche,
corbeau aux quatre phases de battement d’ailes, employé fatigué qui tamponne et bâille,
grenouille qui gonfle sa gorge et bondit. Brief des premiers plans : petits groupes bas,
sans sol rectangulaire ni ombre peinte, végétation et pierres propres à chaque biome.
Brief de la cascade : conserver les architectures et fontaines centrales, retirer les
nuages incorporés, faire descendre les rives aux deux extrémités avec marge transparente.

## Sources retenues

| Asset | Original ImageGen (`exec-…png`) |
| --- | --- |
| voleur | `05a97692-eafb-40b0-ad0b-d586adbf5e0f` |
| skater | `b9e8f01b-2098-4a1b-89b5-7027e74c583f` |
| fee | `439316fa-6941-4953-831a-9155bec0ac92` |
| chevalier | `3c48ed34-4735-4748-8df2-ffd55c669346` |
| barde | `fd17888b-630b-48c1-8640-d97249bd1bd3` |
| sorciere | `59721b4d-c935-4f2b-8989-e08bcb373669` |
| archimage | `a0c977af-2954-4435-b3ec-1178ec17f2b5` |
| druidesse | `e71ec29f-9832-4500-a044-57b8a5a713c2` |
| paladin | `41b94aed-e164-4eb2-88ed-4b4e4a0b618b` |
| necromancien | `caaa7673-6fa9-44ed-8f29-e528e723e49c` |
| licorne | `66ba89d0-cece-4a70-9871-dd5deff21440` |
| squelette | `7aa92de0-d9b8-4c81-8375-bb0b6b860d19` |
| demon | `798f0fcd-ae8b-4d03-8e0d-78f45e459b7c` |
| vampire | `dd6c8eaa-f964-4354-b553-93c1c827f104` |
| teddy | `c497d66e-2c2b-4a16-9a4d-c71df396bbe2` |
| ambient | `482f0555-23c0-4675-b66b-72210836a266` |
| ground-props | `1faf9e68-b403-4c8d-82e5-c30c7376c87c` |
| cascade-back-v2 | `6b221aba-5085-41f1-9ea2-0f51035979a9` |
| chest-journey | `c8169687-1fb2-46cd-950d-4d63d456672e` |

## Compilation

```sh
python3 scripts/compile_sprite_sheet.py SOURCE.png public/art/world-v3/animations/ID.webp
# Pour les exports RGB au damier peint : ajouter --checkerboard.
# Petits objets : --count 8 --columns 4 --props.
# Coffre : --count 5 --columns 5.
```

Le compilateur réutilise la préparation de détourage existante pour les exports RGB,
rejette les planches incomplètes, isole les grandes silhouettes et les place à la même
échelle sur une ligne de sol commune. Il conserve l’alpha des exports RGBA. Les WebP
sont écrits atomiquement pour que le serveur de développement ne serve jamais un
fichier à moitié encodé. Les gutters évitent les débordements entre cellules.

Les poses 0, 1 et 15 du squelette sont retournées à l’affichage : leur source regardait
à gauche, alors que ses poses de déplacement regardent à droite. La direction du
voyage s’applique ensuite à tous les personnages. Les réactions peuvent regarder
momentanément en arrière lorsqu’un personnage recule de surprise.

La victoire réutilise la pose 13 à la place de la pose 14 pour le skater, la sorcière
et la druidesse : les variantes écartées ajoutaient respectivement une deuxième planche
ou une dague étrangère au personnage. Le jeu conserve ainsi leurs accessoires habituels.
