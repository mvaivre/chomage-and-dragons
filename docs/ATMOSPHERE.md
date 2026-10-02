# Atmosphère vivante — première passe Pixi

Les paysages, les tuiles et les illustrations restent les sources validées. Cette
passe ajoute des mouvements et des effets optiques au rendu Pixi existant.

## Profondeur et lumière

- `Atmosphere` utilise trois plans : brume lointaine après les collines, brume et
  rayons après le fond, puis lumière et ombres sur le sol. Les arbres, les panneaux,
  les PNJ et les héros passent devant ces effets.
- Chaque biome possède une couleur et une densité : sous-bois verdâtre, marais
  plus dense, eau et cascades froides, montagne claire, désert légèrement poussiéreux,
  tavernes chaudes. Les intensités disparaissent progressivement sur les 260 unités
  de chaque bord de biome et se répètent sur les tours suivants.
- La couleur suit l'heure de Zurich : lumière chaude le soir, brume plus bleutée
  et rayons très faibles la nuit. Les halos des fenêtres des tavernes deviennent
  visibles au crépuscule ; leur placement suit les fenêtres et lanternes peintes
  de la source `taverne-back.webp`, y compris ses copies inversées.
- Les échantillons gardent des positions monde stables. Leur recyclage se fait à
  opacité nulle ; la largeur, la phase et la couleur ne dépendent pas du numéro de
  leur place dans le pool. Cela évite les sauts pendant le défilement.
- Les effets sont masqués dans les bâtiments. Ils n'ont aucun hitbox et ne
  changent pas les zones cliquables des habitants.

## Vent et contacts

`AtmosphereClock` fournit un temps commun, avancé après la caméra. Une brise lente
avec plusieurs fréquences traverse le monde et anime le feuillage, les ombres,
la brume, les fanions, les lanternes, les petites touffes et la dérive de fumée.
Les cycles des poules, des flammes et des moulins conservent leurs phases locales.

Le chêne proche utilise un `MeshPlane` de 7 × 13 sommets. Les racines, le bas de
l'image et le centre du tronc restent fixes ; seules les branches extérieures
fléchissent. Le panneau reste attaché au tronc, et le point d'appui de l'écureuil
suit le déplacement de sa branche. Le terrain et les rochers ne se déforment pas.

## Coût borné

Quatre masques optiques sont dessinés une fois sur de petits canvas : brume
512 × 192, rayon 128 × 512, ombres de feuillage 256 × 128 et halo 128 × 128.
Leur stockage RGBA total est inférieur à 1 Mio. Aucun canvas n'est repeint par
image, aucun filtre de flou plein écran n'est ajouté et les effets n'augmentent
pas la fréquence du ticker.

| Composition | Brume lointaine | Brume proche | Rayons | Paires lumière / ombre |
| --- | ---: | ---: | ---: | ---: |
| Desktop | 5 | 3 | 5 | 5 |
| Mobile, largeur ≤ 760 px | 3 | 2 | 3 | 3 |
| Rendu logiciel | 2 | 0 | 0 | 0 |

Cela représente au maximum 23 sprites optiques sur desktop et 14 sur mobile,
avec les éléments inutiles masqués. Les halos de fenêtres restent limités à
six petites zones par copie de décor visible. Le rendu logiciel conserve les
arbres en sprites simples et supprime les halos supplémentaires.

Le ticker s'arrête avec les modales qui pausent le jeu et quand l'onglet est
caché. `prefers-reduced-motion` immobilise ces nouvelles animations ; le maillage
des arbres est restauré une seule fois puis ne reçoit plus de mises à jour.

## Comparaison et validation

Dans le panneau DEV, **Lumière et brume** active ou coupe cette passe pour la
comparer sur la même scène. Les commandes DEV déplacent uniquement les repères
visuels ; aucun score n'est modifié.

La forêt a servi de pilote avant l'extension des profils. Les captures du vrai
jeu sont dans `atmosphere-previews/` : desktop 1280 × 720, mobile 390 × 844 et
vue large 1920 × 900. Les vues vérifient les contacts au sol, la lisibilité des
héros et des panneaux, les limites transparentes et l'ordre des plans.

Les huit biomes ont été contrôlés dans ces trois compositions.
La forêt et la taverne ont aussi été contrôlées au crépuscule (`hour=21`)
et en pleine nuit (`hour=22`). Le défilement libre et le dialogue à distance
avec le troll ont été vérifiés sans changer les scores.

- [Forêt, desktop](atmosphere-previews/forest-desktop.png)
- [Forêt, mobile](atmosphere-previews/forest-mobile.png)
- [Forêt, nuit](atmosphere-previews/forest-night-desktop.png)
- [Forêt, défilement](atmosphere-previews/forest-pan.png)
- [Taverne, nuit](atmosphere-previews/tavern-night-desktop.png)

Sur la composition de forêt desktop, le compteur DEV a mesuré environ 30 fps
avec les effets et 29–30 fps sans, avec un p95 proche de 41 ms dans les deux cas.
C'est une observation sur le navigateur de développement, pas une mesure sur un
téléphone physique. La limite de sprites et la résolution plafonnée réduisent
le coût mobile ; la fluidité sur appareils réels reste à mesurer.

Les tests couvrent les raccords entre biomes, les tours suivants, les ancrages
immobiles, les bornes du vent, les budgets et le recyclage à opacité nulle.
`pnpm test` : 87 tests passent. ESLint sur les fichiers modifiés et
`pnpm build --webpack` (avec vérification TypeScript) passent également.
