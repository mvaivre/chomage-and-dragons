# Habitants des biomes et objets cachés

Les nouveaux sprites reprennent le dessin des atlas existants `ambient.webp` et
`environment-troll.webp` : contours noirs irréguliers, aplats patinés, grain et
expressions caricaturales.

| Biome | Nouvel habitant | Objet à collectionner |
| --- | --- | --- |
| Plaine | Hérisson | Courrier scellé |
| Forêt | Renard | Clé |
| Marais | Champignon vivant | Parchemin |
| Lac | Loutre | Chope |
| Cascade | Héron | Boussole |
| Montagne | Bouquetin et yéti | Cristal bleu |
| Désert | Scarabée | Lampe ancienne |
| Taverne | Aubergiste | Couronne |

Chaque espèce reste dans son biome, sur les deux plans de parallaxe et les tours
suivants. Les anciennes poules restent dans la plaine, les corbeaux dans la forêt,
les crapauds et fantômes dans le marais, les squelettes dans le désert et les
gnomes dans la taverne. Les trolls restent en forêt et les yétis vivent uniquement
dans la montagne enneigée. Si un arbre gravé occupe l’emplacement d’un troll,
celui-ci rejoint l’espace voisin entre les troncs au lieu de disparaître.
Les petits habitants passent devant les accessoires du
décor et derrière le joueur pour garder leur silhouette lisible.

Les identifiants des huit trouvailles sont conservés pour préserver les collections
déjà sauvegardées. Les objets restent dans l’arrière-plan avec leur halo discret.

## Assets et prompts

Génération avec l’outil intégré ImageGen, sans API ou CLI de génération. Les prompts
finaux et les chemins des sources sont dans [biome-assets.prompts.json](biome-assets.prompts.json).
Le renard a été redessiné avec les atlas existants comme références ; les autres
habitants et les objets ont suivi ces mêmes références.

- Atlas finaux : `public/art/world-v3/animations/biome-{fox-v2,hedgehog,mushroom,otter,heron,goat,scarab,innkeeper}.webp`
- Métadonnées : mêmes noms avec l’extension `.json`
- Objets : `public/art/world-v3/collectibles/{letter,key,scroll,tankard,compass,crystal,lamp,crown}.webp`
- Import : `scripts/compile_ambient_assets.mjs`, cellules de 384 × 384, grille 2 × 2 et pieds à 356 pour les habitants
- Les découpes et l’encodage WebP préservent la transparence générée

Le yéti utilise `animations/biome-yeti.webp` et ses métadonnées `.json` : quatre
poses, même grille et même contact au sol que les autres habitants. ImageGen
intégré, avec `environment-troll.webp` et `ambient.webp` comme références de style.
Prompt exact : [yeti.prompt.txt](yeti.prompt.txt). Source générée :
`/Users/mika/.codex/generated_images/01a11c1c-8b80-7b32-a69a-18095959e64f/exec-4ac99b35-58b2-462c-a684-488d5c66a791.png`.
Import avec `compile_ambient_assets.mjs`, options `--columns=2 --rows=2
--cell-width=384 --cell-height=384 --baseline=356 --islands`.

Quatre poses par habitant permettent un repos, un clignement, un geste et une
réaction. La respiration garde les pieds fixes et les mouvements réduits
suppriment les animations d’attente.

## Gestes et transitions

Le renard et le yéti disposent chacun de quatre poses supplémentaires : préparation,
doigt d’honneur, haussement de patte ou de main et rire moqueur. Les trois réactions
alternent au fil des clics. Un geste se prépare, reste lisible puis revient au repos.
Les atlas d’attente existants sont conservés.

Les neuf habitants utilisent un fondu bref de 120 ms avec accélération et décélération
entre les poses. Les deux dessins partagent le même pivot au sol et la sélection
par viewport les traite comme un seul personnage. Les mouvements réduits affichent
directement la pose et la gardent fixe pendant la réaction.

- Atlas : `public/art/world-v3/animations/biome-fox-gestures.webp` et `biome-yeti-gestures.webp`, avec métadonnées `.json`
- Prompts ImageGen intégré : [renard](fox-gestures.prompt.txt) et [yéti](yeti-gestures.prompt.txt)
- Références : atlas existants du renard, du yéti et du troll
- Sources ImageGen dans `/Users/mika/.codex/generated_images/01a11c1c-8b80-7b32-a69a-18095959e64f/` : `exec-f91a6603-7033-4772-976b-35efa0867816.png` et `exec-1a264be1-9ea5-4f16-aa7d-e209a4ebc305.png`
- Import déterministe : `compile_ambient_assets.mjs`, grille 2 × 2, cellules 384 × 384, pieds à 356, option `--islands`

## Un seul exemplaire visible

Les habitants du chemin, de l’arrière-plan et des arbres partagent une sélection
par apparence : un seul exemplaire de chaque personnage est dessiné dans la zone
visible. Les ombres et les zones de clic des doublons sont masquées avec eux.
Les personnages des joueurs gardent leur affichage habituel.

La sélection conserve l’individu déjà présent tant que sa silhouette reste à
l’écran, pour éviter les échanges pendant un déplacement de caméra. Une réaction
en cours garde sa priorité. Le calcul utilise les positions projetées réelles,
y compris la parallaxe, les mouvements des animaux et le redimensionnement.

## Vérification

Les tests contrôlent les habitats, les quatre poses distinctes, la transparence,
les marges, le contact au sol et les interactions. Le vrai jeu a été inspecté à
390 × 844, 1280 × 720 et 1920 × 1080 avec le joueur visible. Les vérifications de
collecte couvrent les huit objets et leur sauvegarde après rechargement.
