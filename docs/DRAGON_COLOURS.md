# Dragons et souffle de feu

Les cinq variantes apparaissent sur chaque tour : vert en forêt, noir aux yeux rouges dans le marais, bleu dans la montagne enneigée, rouge dans le volcan et doré glamour avant la taverne. La variante dépend du nid et reste la même quand le dragon avale puis recrache le joueur. Le sort de dragon reprend aussi la couleur du biome où il commence. Le dragon vert et les paysages existants sont conservés.

Le dragon doré porte un collier de perles et de rubis, une selle ornée et du maquillage. Cinq petits éclats s’allument sur son corps et ses ailes. Les variantes gardent les huit poses et les pieds à la même hauteur dans chaque cellule.

Un souffle de feu accompagne le troisième avertissement et revient brièvement pendant l’attente. Quatre flammes peintes se fondent entre elles, avec un halo et quelques braises. Le jet part de la gueule ouverte, reste derrière les joueurs et se raccourcit en portrait pour tenir dans l’écran. Il ne modifie ni les pas, ni les récompenses, ni la sauvegarde. La séquence de quatre clics reste inchangée.

Le bouton « Défier le dragon » est placé sous la plaque du joueur pour laisser son nom lisible.

Les mouvements réduits désactivent les souffles périodiques et figent les scintillements. Le troisième clic affiche une flamme fixe pendant l’avertissement. Les poses gardent leur pivot aux pieds, y compris pendant les changements d’expression.

## Images et import

Création avec l’outil intégré `image_gen`, en prenant l’atlas vert existant comme cible de recoloration et référence de style. Les sources originales sont conservées dans le dossier de génération Codex. Les prompts exacts, les références et les destinations figurent dans [DRAGON_COLOURS_ART_PROMPTS.json](DRAGON_COLOURS_ART_PROMPTS.json).

Fichiers actifs dans `public/art/world-v3/animations/` :

- `dragon-v3.webp` et `.json` : vert existant, conservé
- `dragon-red-v1.webp` et `.json` : rouge
- `dragon-blue-v1.webp` et `.json` : bleu
- `dragon-black-v1.webp` et `.json` : noir aux yeux rouges
- `dragon-gold-v1.webp` et `.json` : doré glamour
- `dragon-fire-v1.webp` et `.json` : quatre instants du souffle

Les quatre nouvelles couleurs sont importées dans des atlas 2048 × 1024, avec huit cellules de 512 × 512 et une ligne des pieds à 476. Le souffle utilise quatre cellules de 512 × 256 avec une origine commune à `(8,128)`. Les fichiers ajoutés représentent environ 1,5 Mo de WebP.

Reproduction de l’import : `node scripts/compile_dragon_colours.mjs`. Ce script utilise l’importeur d’atlas existant et `scripts/compile_dragon_fire.mjs` pour recaler la pointe de chaque flamme. Aucun filtre de teinte global ne recolore la peau, les cornes et la selle dans le navigateur.

## Vérification

Le dragon rouge et son souffle sont d’abord inspectés dans le vrai volcan sur ordinateur, mobile et écran large. Les quatre autres variantes passent ensuite le même contrôle : contact au sol, lisibilité du personnage joueur, style, départ de la flamme et absence de découpe en portrait. Les tests contrôlent les cinq habitats, les huit poses de chaque couleur, la transparence, le cycle des souffles, les mouvements réduits, l’identité pendant l’ingestion et la sauvegarde inchangée.

Validation : 154 tests unitaires, ESLint, TypeScript et compilation de production. Treize vérifications navigateur passent en production, dont les quinze compositions des cinq variantes, les clics rapprochés, le réveil et le retour du personnage après ingestion.
