# Audit du décor — 22 octobre 2026

Audit du jeu local en rendu voxel : neuf biomes, huit transitions, trois intérieurs.
49 captures avant, 49 après la correction du grain, puis 49 avec le relief et le rendu miniature corrigés : ordinateur 1440 × 960, mobile tactile émulé
390 × 844, plus une vue inversée pour chaque biome. Le pilote volcan a aussi été
inspecté de près et en 1920 × 1080 avant généralisation. Les contrôles de géométrie ont été effectués sans profondeur de champ pour laisser les raccords visibles ; la brume du jeu restait active. Une dernière série conserve la profondeur de champ réelle, avec des vues inversées des neuf biomes et des vues proches et larges du hameau alpin et du volcan. Le village et la forêt ont également été contrôlés avec le personnage réel.

## Défauts trouvés et corrigés

| Défaut | Cause | Correction |
| --- | --- | --- |
| Le grain s'arrête à une ligne droite devant et derrière | Le sol proche recevait une couleur aléatoire par demi-mètre ; les prolongements avaient une couleur uniforme sur des faces de deux mètres | Même matériau et même grain procédural en coordonnées du monde sur les deux maillages |
| La végétation et les petits cailloux s'arrêtent au même endroit | Les générateurs s'arrêtaient aux limites Z −15 / +12 | Enveloppe continue de densité traversant ces limites et prolongement des détails bas jusqu'à extinction progressive |
| Les petites plantes changent brusquement dans certaines transitions | Choix du biome au centre d'un bloc de 16 mètres | Mélange déterministe des espèces selon leur position dans la transition de 12 mètres |
| Gros cubes blancs dans les rivières | Les matrices d'animation des reflets remplaçaient leur petite échelle par l'échelle unité | Échelle .55 × .025 × .09 conservée à chaque mise à jour |
| Surcoût de rendu après ajout des détails lointains | Les nouveaux objets élargissaient les volumes des groupes contenant toute l'herbe proche | Groupes distincts pour les prolongements avant et arrière, subdivisés longitudinalement sur mobile |
| Petits objets potentiellement décalés sur les berges | Échantillonnage bilinéaire différent des triangles réellement rendus | Échantillonnage exact des triangles du prolongement et du terrain central, tenant compte des rivières |
| Relief strié de bandes répétitives | Chaque cellule formait une terrasse avec un riser vertical | Sommets partagés dans les deux axes ; pentes facettées, relief irrégulier et coloration minérale selon la pente |
| Rivières rectilignes et berges abruptes | Largeur et axe constants, fond encaissé sans raccord | Axe sinueux, largeur variable, berges interpolées ; méandre resserré sous les ponts |
| Maisons sur de hautes fondations cubiques | Le bâtiment compensait seul les différences d'altitude | Terrain nivelé sous les maisons et raccordé progressivement sur 4,5 m ; pilotis intentionnels conservés |
| Objet narratif dans une rivière | Emplacement fixé indépendamment de l'eau | Placement sur une berge sèche et même emprise réservée aux plantations |
| Impression de simple dégradé | Flou coupé dans les captures d'audit et lié au bouton de lumière ; caméra orthographique | Perspective réelle, profondeur de champ indépendante du bloom, environnement extérieur sombre |

Le grain combine plaques de couleur, cellules de 50 cm et petites inclusions. Ses
paramètres varient progressivement avec le biome : herbe, litière, boue, galets,
mousse, neige, sable et cendre. Il ne nécessite aucune texture bitmap ni triangle
supplémentaire. Les eaux utilisent un masque explicite pour conserver leur surface
lisse. Les petites inclusions sont atténuées lorsque leur taille devient inférieure
au pixel. Les arbres, bâtiments et monuments conservent leur grammaire existante.

## Parcours visuel

| Zone | Position de contrôle, unités sauvegardées | Résultat du raccord avant/arrière |
| --- | ---: | --- |
| Plaine | 1 000 | Grain et herbe continus ; disparition de la grande plage verte unie |
| Forêt | 6 800 | Litière et sous-bois continus ; reflets de rivière fins |
| Marais | 9 200 | Grain de terre humide et détails bas prolongés |
| Lac / monument des larmes | 13 600 | Galets et herbe continuent devant le chemin et derrière le monument |
| Cascade | 17 100 | Mousse et pierres prolongées ; eau distincte du sol |
| Montagne | 20 000 | Neige et éclats minéraux continuent sur les prolongements |
| Désert | 23 200 | Grain et stries de sable présents jusqu'à la brume |
| Volcan | 24 857 | Cendre et scories continues, y compris depuis l'arrière |
| Taverne extérieure | 27 600 | Herbe et petites fleurs prolongées autour du vignoble |

Les huit limites de biomes ont été parcourues sur ordinateur et mobile. Les sols de
l'ORP (2 200), de l'usine (4 900) et de la taverne (29 500) conservent leurs textures
et leur scène intérieure dédiée. Le test de sauvegarde vérifie que ce parcours de
prévisualisation ne modifie pas la partie.

## Vérifications et coût

- Test GPU des neuf styles : déplacement de la séparation entre maillage fin et
  grossier sans modifier les pixels du grain ; contrôle indépendant de l'eau lisse.
- Tests des limites de densité, du contact réel des détails avec le terrain et de
  l'échelle des reflets sur plusieurs instants d'animation.
- Régression du cadrage réel : chemin au centre de la zone utilisable sur ordinateur
  et mobile, à plusieurs zooms et angles de rotation.
- Comparaison GPU du jeu avec / sans flou sur ordinateur et mobile : réduction des
  hautes fréquences dans les bandes avant et arrière, personnage toujours net.
  Couper les effets de lumière conserve la profondeur de champ.
- Parcours final des 20 positions en mobile émulé : maximum 122 780 triangles et
  144 appels de dessin. Les captures supplémentaires avec le personnage réel
  culminent à 125 616 triangles et 147 appels. Budget sous 150 000 / 200.
- Mobile équilibré : flou à un quart de résolution (98 × 211 pour 390 × 844),
  sans bloom ni shadow map. Le profil faible coupe le flou et libère ses grandes
  cibles si le temps de rendu reste trop élevé. Ordinateur : flou à mi-résolution.
- 172 tests unitaires, lint et build de production validés. Régressions navigateur :
  cadrage, occlusion, grain GPU, profondeur de champ, streaming et budgets.

Ces mesures proviennent de Chrome sur un ordinateur avec émulation mobile. Elles
ne constituent pas une mesure de fréquence d'images sur un téléphone physique.

## Clôture de la passe

Les trois défauts résiduels de la première passe — stries du relief, berges trop
rectilignes et fondations trop hautes — sont traités. Le contrôle du hameau alpin,
des berges de forêt et de la transition montagne / désert a précédé le parcours
complet. Les couleurs, le grain, les décors éloignés, la route et les mécaniques
existantes sont conservés. Les déplacements de décor ne changent pas la sauvegarde.

Il s'agit d'un échantillonnage visuel des compositions listées, pas d'une garantie
que chaque objet procédural est sans intersection sous tous les angles et à tous
les tours de carte. Les contrôles existants d'emprises des arbres et de trajectoires
intérieures restent nécessaires.

## Captures locales

- [Vue d'ensemble finale des neuf biomes](../.qa/miniature-final/final-desktop-overview.jpg)
- [Vue d'ensemble finale sur mobile](../.qa/miniature-final/final-mobile-overview.jpg)
- [Comparaison initiale du volcan](../.qa/decor-audit/volcano-comparison.jpg)
- Captures sans flou après sculpture : `.qa/decor-audit/corrected/`.
- Parcours complet final avec flou : `.qa/miniature-final/final-audit/`.
- Vues finales proches / larges / mobiles : `.qa/miniature-final/final/`.
- [Volcan en perspective avec profondeur de champ](../.qa/miniature-final/final/volcano-wide.png)
- [Hameau alpin et terrain nivelé](../.qa/miniature-final/final/alpine-desktop-close.png)
