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
| Montagne | Bouquetin | Cristal bleu |
| Désert | Scarabée | Lampe ancienne |
| Taverne | Aubergiste | Couronne |

Chaque espèce reste dans son biome, sur les deux plans de parallaxe et les tours
suivants. Les anciennes poules restent dans la plaine, les corbeaux dans la forêt,
les crapauds et fantômes dans le marais, les squelettes dans le désert et les
gnomes dans la taverne. Les petits habitants passent devant les accessoires du
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

Quatre poses par habitant permettent un repos, un clignement, un geste et une
réaction. La respiration garde les pieds fixes et les mouvements réduits
suppriment les animations d’attente.

## Vérification

Les tests contrôlent les habitats, les quatre poses distinctes, la transparence,
les marges, le contact au sol et les interactions. Le vrai jeu a été inspecté à
390 × 844, 1280 × 720 et 1920 × 1080 avec le joueur visible. Les vérifications de
collecte couvrent les huit objets et leur sauvegarde après rechargement.
