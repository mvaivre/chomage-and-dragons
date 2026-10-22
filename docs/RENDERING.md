# Rendu voxel

Le monde utilise des miniatures voxel en volume, des ombres douces, des palettes
propres aux biomes et des sources de lumière chaudes dans le décor. Le monde et les
13 mini-jeux utilisent Three.js. L'interface reste en DOM pour ses contrôles,
son clavier et ses dialogues accessibles. Un HUD minimal en vert profond et ivoire
laisse le paysage visible ; les icônes et portraits illustrés originaux sont conservés. `/atelier-3d` ouvre désormais le vrai jeu.

## Contrat avec les règles

Les distances de sauvegarde restent inchangées : 30 240 unités par traversée,
200 pas, les mêmes neuf biomes et les mêmes trois bâtiments. `voxel/world.ts`
convertit ces distances en mètres de scène (50 unités par mètre). Les positions
visuelles et le relief n'écrivent jamais dans le journal. Une ancienne sauvegarde
s'ouvre directement ; aucune migration du format n'est nécessaire.

Les simulateurs de mini-jeux, leurs graines, leurs hitboxes et leurs contrôles
restent dans `lib/game`. `VoxelPainter` projette le plan de jeu sur les mêmes
coordonnées logiques avec une caméra oblique. La précision des pointeurs est ainsi
conservée, avec de vrais volumes, éclairages et ombres. Les textes des scènes utilisent des textures canvas générées localement.
Les illustrations de l’interface viennent de la banque WebP originale.

## Monde continu

`world.ts` partage le relief et la palette entre tous les chunks. Les hauteurs sont
échantillonnées aux mêmes coordonnées globales : aucun bord de tuile indépendant.
Les biomes se mélangent sur 12 mètres ; la route reste continue même lorsque la
montagne et le volcan montent en altitude. La tuile mesure 27 mètres de profondeur,
avec des bords droits aux coordonnées Z = −15 et +12, indépendants du chemin sinueux.
Les tronçons mesurent toujours 16 mètres de long. L’avant reste plat dans l’axe de
la profondeur ; les montées longitudinales et les collines arrière sont conservées.

Le dessous est fermé par des bandes lisses qui suivent l’altitude du parcours. À
chaque abscisse, les deux faces se terminent exactement à cette même altitude,
1,6 m sous le niveau de la route. La face arrière peut être plus haute selon le
relief ; elle ne descend jamais sous le fond de la tuile. Les cours d’eau restent
contenus au-dessus de ce fond. Trois couches — surface, terre et roche — habillent
les coupes. Les coordonnées globales garantissent la jonction entre tronçons.

Deux rangées de plantations, dont une le long du bord arrière, évitent les trous de
décor dans les virages et les descentes. Une grille de 0,5 m ne produit que les
faces exposées. Les fleurs, fougères, petits rochers et accessoires de premier plan
restent bas ; les papillons s’animent sans gêner la lecture des personnages.

Cinq tronçons au maximum suivent la caméra. Les tronçons initiaux sont prêts avant
la première image ; ensuite, un nouveau tronçon est généré par image. La brume
masque les extrémités longitudinales ; les limites en profondeur restent visibles. Les
chunks quittant la zone libèrent leurs géométries et leurs buffers d'instances.
Les matériaux et le cube de base sont partagés.

L’ORP, l’usine et la taverne ont chacun une tuile intérieure dédiée. Le paysage
extérieur et ses habitants sont entièrement masqués : seuls la salle, ses figurants
et les joueurs présents dans cette salle sont rendus. Le mur arrière s’efface
lorsque la caméra passe derrière. Les grands feuillages font de même à l’extérieur. Les habitants,
les neuf objets cachés, les cinq couleurs de dragons, les panneaux personnalisés,
les vignettes de biome et les huit scènes de la fête gardent leurs textes et leurs
identités. Chaque variante de réaction dispose de sa propre mise en scène.

## Habitants, collisions et cadrages

Les PNJ et les animaux se promènent sur de petites boucles déterministes ; les
employés restent près de leurs postes. Un clic les arrête temporairement et les
fait regarder la caméra. Toutes leurs réponses, y compris celles des dragons et
des invités de la taverne, tournent dans la banque de punchlines. La mécanique
spéciale de la quatrième interaction avec le dragon est conservée.

`voxel/life.ts` simule une physique cartoon locale : test de collision sur le segment
parcouru par un héros, impulsion, gravité, rebonds amortis et remise debout. Les
petits pas de simulation évitent de traverser un PNJ à grande vitesse. Un délai
évite les impacts répétés et les habitants restent dans la tuile. Ces états ne
sont jamais sauvegardés et n’interviennent pas dans les règles du jeu.

Les héros ont une tête, un torse, des bras et des pieds articulés. Leur marche suit
la distance parcourue, avec des transitions de vitesse et d’orientation ; les actions
ajoutent des poses d’envoi, de choc et de célébration. Les animations et la physique
s’arrêtent avec les dialogues de jeu et respectent la réduction des mouvements.

Les panneaux et les habitants se sélectionnent dans les volumes 3D ou avec leurs
boutons accessibles. Un clic déclenche un gros plan de 5,5 secondes, puis le cadrage
précédent revient automatiquement. Les inscriptions restent sur les panneaux ;
le cadrage les présente de face, sans fenêtre qui répète leur texte. Fermer la phrase, reprendre la marche ou manipuler
la caméra annule le gros plan. Une collision ne provoque pas de zoom automatique.

## Récupération des coffres

Les coffres occupent le centre du chemin, aux mêmes paliers de dix pas que dans
le journal. Ils utilisent un modèle voxel creux avec un couvercle articulé.
Les coffres placés dans un bâtiment appartiennent à sa scène intérieure.

Le trajet visuel s’arrête 1,25 m avant le coffre, même si l’action dépasse son
palier. L’effet de l’action se termine d’abord ; le coffre est ensuite mis en
évidence fermé, soulevé au-dessus du personnage et ouvert avec une lumière dorée.
L’ouverture commence après 1,9 s, et la collecte dure 3,2 s. Le personnage reprend
les éventuels pas restants avant l’affichage du butin. Les bonus de mini-jeux
empruntent cette même séquence.

Un coffre récupéré s’efface du chemin pour ce joueur ; annuler l’action qui l’a
fait gagner le rétablit. Aucune animation ne crée d’événement supplémentaire ou
ne change le nombre de pas et de butins. Le jeu attend cette séquence avant de
présenter la carte de récompense et les invitations aux défis suivants. Le mode
réduit conserve l’ordre des étapes sans les petits sauts et tremblements.

## Le tampon du rejet post-entretien

Chaque rejet après entretien ajoute le même gag physique à sa variante visuelle :
le tampon tombe, écrase le héros à 7,5 % de sa hauteur, puis accompagne son vrai
déplacement. La silhouette s’élargit pour rester visible autour du socle. Le tampon
se relève après 2,75 s ; le héros se déplie avec un étirement, un saut et des
oscillations amorties, puis retrouve exactement ses proportions à 3,9 s. Un impact
sourd et un « boïng » suivent les réglages sonores.

`voxel/stamp-crush.ts` partage une seule horloge entre le contact du tampon et
la déformation du héros. Sa hauteur propre conserve le contact pour les quinze
personnages. Les accessoires des six variantes restent visibles à côté du tampon.
L’indication `stampCrush` appartient seulement aux effets du rendu : les pas,
variantes sauvegardées et résultats des mini-jeux restent inchangés. Le gag se
joue aussi pour les actions reçues des amis.

L’arrivée attend la fin du rebond avant d’ouvrir un coffre ou de proposer le
mini-jeu. La réduction des mouvements garde les proportions normales et masque
cette animation. La pause fige l’horloge ; l’annulation ou la fin de l’effet
rétablit la pose et les proportions normales.

## Interface et dialogues

Le portrait actif ouvre le carnet : quêtes, 13 défis, neuf objets perdus, butins,
son et verre du mois. La carte et le classement restent accessibles par la couronne.
Les cinq actions et leur annulation restent au bas de l’écran, avec leurs icônes
originales et raccourcis clavier. Une pastille sur le portrait signale les butins.
L’entrée du défi quotidien a été retirée ; les anciens résultats et leur format de
sauvegarde sont conservés. Le test de personnalité reste un mini-jeu normal.

Les treize mini-jeux placent leur bouton de démarrage au centre du terrain. Avant
le lancement, seule l’action pour passer reste dans le pied de fenêtre. Les boutons
de jeu et de fin gardent leur comportement ; le focus passe du démarrage au jeu
sans exiger un second clic. Une grille superpose le bouton au terrain sans imbriquer
de boutons, y compris sur les petits écrans en paysage.

Les répliques apparaissent toutes les 32 ms avec de petites pauses à la ponctuation,
un tic synthétique par lettre et des mots importants en doré. Le bouton « Tout
afficher » révèle instantanément la suite. Les sons suivent le réglage muet et
s’arrêtent à la fermeture ; les dialogues en pause ou dans un onglet masqué ne
continuent pas à taper. La réduction des mouvements affiche immédiatement la
phrase entière. Une copie accessible annonce une seule fois la phrase complète,
sans faire lire chaque lettre aux lecteurs d’écran.

## Contrôles et budget

Glisser tourne la vue ; molette/pincement change le zoom. Majuscule + glisser ou
les flèches explorent le chemin. Les boutons de caméra sont accessibles au clavier.
Le bouton lumière coupe le bloom. L'heure de Zurich pilote l'éclairage ; les
musiques existantes suivent toujours le personnage réel, même en exploration.

Le monde plafonne à 30 images/s, descend à 10 derrière un dialogue et s'arrête
lorsque l'onglet est caché. Le temps d'animation s'arrête avec les dialogues.
La résolution est plafonnée à 1,5 DPR et 1,8 million de pixels dans le monde ;
les arènes conservent jusqu'à 2 DPR pour la précision des petits objets.
Les ombres sont recalculées lorsque le contenu ou les joueurs bougent ; les
promenades seules limitent leur mise à jour à dix fois par seconde.

Pixi, le moteur de paysage 2D, les atlas du monde et leurs scripts de compilation
ont été retirés. Les portraits, les icônes, la carte illustrée et les enregistrements
musicaux sont conservés. Une géométrie voxel n'est pas gratuite en mémoire :
les buffers, ombres et render targets restent à surveiller sur de vrais téléphones.

## Vérifier

`tests/browser/voxel-chest.test.mjs` vérifie l’arrêt au palier, le couvercle fermé
avant l’ouverture, la reprise d’un trajet plus long, les intérieurs, le mode réduit
et la restauration du coffre après annulation.

- `pnpm test` : règles et sauvegardes, continuité de la route, orientation des faces,
  profondeur bornée, modèles distincts, articulations et libération des instances.
- `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build`.
- `pnpm test:browser` : parcours réels, bonus, annulation, groupes sur deux appareils,
  clavier, musique, collection, initiation et les 13 mini-jeux.
- Les captures de `voxel-world.test.mjs` sont écrites dans `.qa/refonte-voxel/` :
  neuf biomes, compositions mobile/desktop/large et mini-jeux mobiles.
- `tests/browser/voxel-life.test.mjs` vérifie les promenades, punchlines, gros plans
  desktop/mobile, collisions et absence d’écriture des états physiques.
- `tests/browser/voxel-stamp.test.mjs` vérifie la compression, la glissade, le
  rebond, le délai avant le mini-jeu, l’annulation et les six variantes en mouvement réduit.
- `.qa/voxel-rich/` conserve les comparaisons jour/nuit, mobile, caméra arrière et
  les trois intérieurs. Le test navigateur vérifie aussi entrée dans l’ORP,
  rechargement et annulation vers le paysage extérieur.

Le serveur de développement expose un panneau d'exploration avec une position,
les biomes, les personnages et les réactions. `window.__voxelWorld` donne les
compteurs de diagnostic ; il ne permet pas de modifier la partie.

## Budgets du rendu voxel

Les arbres du terrain utilisent 6 à 8 boîtes par essence, soit **72 à 96 triangles**
par arbre, tronc et branches compris. Les teintes par petits carrés du feuillage
sont un motif statique dans le shader : aucune feuille n'ajoute de cube ni de bitmap.
Les sapins enneigés, bouleaux, arbres roses, arbres d'automne et saules gardent des
silhouettes et couleurs distinctes. La géométrie des personnages articulés reste
indépendante de ce budget.

`VoxelResources.batch` regroupe les cubes par type de surface (opaque/émissive),
avec une couleur par instance, au lieu d'un dessin par couleur. Les couleurs sont
conservées en espace linéaire, y compris pour l'émission. Les limites spatiales des
lots restent locales pour permettre la suppression des objets hors champ.
Le terrain échantillonne une fois sa hauteur et celle de ses voisins dans un halo
commun aux chunks, et conserve la même géométrie sur tous les appareils. Sur mobile,
les sols et les petits décors sont regroupés en bandes de 4 m plutôt qu'en un seul
lot par chunk : le moteur ignore les bandes hors champ. La somme des surfaces,
positions et couleurs est strictement identique ; un test compare les deux versions.

Les lanternes, le feu, la lave et les coffres fournissent des sources logiques au
`LocalLightPool`. Seules les sources proches de la caméra et de la scène visible
alimentent 4 emplacements GPU sur ordinateur, 2 sur mobile. Leur nombre dans le
shader reste constant : traverser un biome ou entrer dans un intérieur ne provoque
plus une compilation pour chaque combinaison de lumières.

| Profil | Bloom | Résolution | Ombres | Lumières locales |
| --- | --- | --- | --- | --- |
| Ordinateur | Oui, sans multisampling HDR redondant | DPR ≤ 1,5 ; 1,4 M pixels | 1024, rafraîchissement ≤ 8 Hz | 4 |
| Mobile / appareil limité | Non | DPR ≤ 1 ; 700 k pixels | Contact uniquement, aucune shadow map | 2 |
| Repli automatique | Non | DPR ≤ 0,85 ; 450 k pixels | Contact uniquement | 2 |

Le profil mobile est choisi avant le premier dessin avec la largeur, le pointeur
principal tactile, le nombre de cœurs et la mémoire déclarée. Le navigateur peut ne
pas fournir cette dernière. Le mode de repli répond à une lenteur persistante ; il
ignore le chargement récent et les pauses, et ne remonte pas en qualité au cours
de la session pour éviter les oscillations. Les cibles HDR restent à 1 × 1 lorsque
le bloom est désactivé. Les PNJ et accessoires des scènes cachées ne sont pas animés.

`window.__voxelWorld.performance` expose le profil, les temps CPU de mise à jour et
de soumission du rendu (ce ne sont pas des temps GPU), la résolution, les lumières,
les shaders et le nombre d'images. `shadowMapAllocated` doit être faux sur un téléphone,
`contactShadows` indique le nombre d'empreintes utilisées. `?profile` ajoute
`mainGeometry`, la répartition des triangles réellement soumis à la passe principale.
Les compteurs de triangles/appels incluent les
passes d'ombre seulement lors de leur rafraîchissement : comparer aussi les maxima.

La capture `.qa/voxel-performance/before.json` montre 650 appels et 1,28 M triangles
dans la forêt à x = 4000 avant optimisation. Les allers-retours optimisés mesurés
restent sous 180 appels et 410 k triangles dans cette vue, ombres incluses. Ces
compteurs décrivent la charge et ne promettent pas un FPS identique sur tous les GPU.

`tests/voxel.test.mjs` impose le budget de chaque essence, la conservation des
couleurs par instance, la libération des lumières et l'hystérésis du profil.
`tests/browser/voxel-performance.test.mjs` parcourt volcan/forêt plusieurs fois sur
ordinateur et mobile ; il vérifie les maxima de charge, les shaders bornés, le
profil mobile initial et l'absence de modification de la sauvegarde.

Mesure après retrait des ombres temps réel mobiles et simplification de la taverne, sur 12 vues (neuf biomes hors intérieur, trois intérieurs),
45 images de rendu par vue, caméra par défaut :

| Profil | Moyenne des 12 vues, ombres comprises | Plus forte pointe |
| --- | --- | --- |
| Mobile 390 × 844, écran DPR 3 limité à 1 | 89 635 triangles/image | 135 536 (plaine) |
| Ordinateur 1440 × 960, DPR 1 | 148 715 triangles/image | 361 886 (plaine) |

Source : `.qa/voxel-mobile/scene-budgets.json`. Comparaison précédente conservée dans
`.qa/voxel-mobile/before.json`. Il s'agit d'une moyenne
uniforme de vues représentatives, pas d'une moyenne pondérée par le temps que les
joueurs passent dans chaque biome. Les mesures mobiles utilisent le profil et le
viewport d'un téléphone dans Chrome sur ordinateur ; elles ne mesurent pas les FPS
d'un GPU de téléphone. Les effets ponctuels et les groupes plus nombreux peuvent
augmenter les pointes. Le repli automatique réduit encore la résolution si le rendu
demeure lent.

Les 15 personnages partagent désormais un modèle à grandes masses de couleur dans
le monde, le HUD, le choix des classes, le carnet et les trois rites d'initiation.
Ils utilisent **288 à 384 triangles chacun** (6 à 7 appels de dessin), contre
2 868 à 6 864 avant cette révision. Chaque modèle conserve ses quatre membres
articulés, son visage, ses accessoires distinctifs et les poses des actions. Le test
impose moins de 1 000 triangles avec le double de silhouette d'occlusion optionnel.

Les aperçus de l'interface partagent **un seul contexte WebGL** : un studio
orthographique rend directement vers des canvas 2D, sans encodage ni textures.
Les vignettes sont statiques ; seul le personnage sélectionné ou le rite visible
s'anime. Le studio suspend les vues hors écran et les onglets cachés, respecte les
mouvements réduits, plafonne le DPR mobile à 1 et ne crée ni ombres temps réel ni
post-traitement. Il libère ses ressources quand la dernière vue disparaît. Le choix
peut tourner par glissement ou avec deux boutons accessibles au clavier.
L'entraînement utilise le même personnage enregistré, le coffre à couvercle articulé
et le modèle du crapaud ; ses exemples et sa sauvegarde restent isolés du journal. Les anciennes illustrations de personnages et le générateur détaillé
abandonné ne sont plus utilisés.


Sur les mêmes vues mobiles de la taverne : la pointe extérieure passe de 474 476
à 133 978 triangles ; l'intérieur de 143 140 à 44 102. La façade et ses deux lanternes
restent sous 3 000 triangles. Les sols et murs de la taverne sont des bandes qui suivent
les altitudes originales ; les teintes des carreaux et tuiles sont calculées dans le
shader. Le bar, les bouteilles, les tables, les personnages et leurs animations restent
modélisés. Les autres intérieurs conservent leur construction précédente.

`ContactShadows` remplace les ombres projetées sur mobile : une seule passe instanciée
sans lumière, sans bitmap, sans cible de rendu, deux triangles par empreinte et
256 empreintes au maximum. Les arbres, maisons et meubles enregistrent leurs
empreintes à la génération. Les personnages réutilisent le même lot pour suivre leurs
pieds ; l'opacité diminue quand ils sont en l'air. Les empreintes respectent la brume
et la scène intérieure/extérieure. Ce sont des ombres de contact approximées, pas
une simulation de l'éclairage du soleil. Les ombres du profil ordinateur sont conservées.
Les mini-jeux désactivent aussi les ombres temps réel et plafonnent leur DPR sur mobile.

Les tests navigateur imposent désormais une pointe mobile sous 150 k triangles sur
les trajets testés, taverne extérieure/intérieure comprise, aucune allocation de
shadow map dès la première image et après plusieurs voyages, ainsi que le bon profil
des 13 mini-jeux. Ce seuil décrit ces compositions, pas toute caméra ni toute taille
de groupe possible. Les captures des trois compositions sont dans `.qa/voxel-mobile/`.


L’initiation courte (progression version 3) comporte six actions : essayer une
candidature, continuer, ouvrir un coffre, lancer son pouvoir, continuer et commencer
le voyage. Il n’y a plus de vol imposé ni de questionnaire. Les mini-jeux de dragon
restent disponibles dans les quêtes. Les scènes partagent une clairière voxel
contenue, avec terrain, arbres, fleurs, lanternes et petite taverne. Les animations de
marche, de couvercle et de transformation durent au plus 750 ms ; les mouvements
réduits les passent immédiatement. Les anciens marqueurs « initiation vue » restent
valides, les progressions inachevées de l’ancienne version repartent du nouvel essai.

Le lecteur musical appartient au layout racine : les mêmes deux éléments audio
survivent à la navigation accueil → sélection → jeu. Il prépare la piste dès l’arrivée
et appelle directement `resume()` et `play()` depuis `click`, `touchend`, `pointerdown`
et `keydown`, sans délai ni dépendance à `navigator.userActivation`. Les promesses
de lecture sont numérotées : un ancien refus d’autoplay ne peut pas annuler la
lecture autorisée par un geste plus récent. L’état Safari `interrupted` est aussi
repris. Le son respecte les préférences, la visibilité et le volume réduit pendant
les défis ; quitter le jeu restaure le volume de l’accueil. Un contrôle du son est
accessible dès l’accueil et la sélection.

Les emplacements des façades, maisons du village, moulins, monuments et décors
narratifs sont désormais partagés dans `voxel/layout.ts`. La plantation réserve
l’empreinte entière, élargie au rayon de la couronne : un tronc libre ne suffit pas
si ses feuilles traversent un toit. Les ailes du moulin conservent aussi un axe de
vue dégagé. Le moulin repose sur le cœur plat d’une petite colline en terrasses.
Un test génère les chunks de deux tours complets et compare les volumes des arbres
aux emplacements réservés, y compris de part et d’autre de la jonction des tours.
Les paysages lointains ne changent pas.

Le départ comprend trois maisons nommées, le petit pont et sa mare, des habitants
et les lanternes existantes. Des mares espacées de 26 mètres apparaissent au premier
plan dans les biomes végétaux : lit creusé, eau horizontale opaque, berges, roseaux,
nénuphars et deux canards animés. Leur génération est déterministe et ne décale pas
le tirage des arbres ou fleurs existants. Une vignette ajoute moins de 500 triangles,
les canards 96 chacun ; pas de réflexion, particules ni transparence supplémentaire.
La profondeur de la tuile et les allées restent libres.

Les trois salles utilisent une allée droite sur leur propre sol en relief, plutôt
que les méandres du chemin extérieur. Le convoyeur de l’usine est reculé. Une entrée
ou sortie partage son emplacement entre façade, porte articulée, dalles d’approche
et trajectoire du personnage. Le passage marque une courte pause devant la porte,
change de scène sous un fondu puis reprend la distance enregistrée. La caméra
bascule avec le personnage ; les mouvements réduits passent directement à la salle.
L’aller, le retour par annulation, les coffres et les longues distances conservent
les coordonnées de sauvegarde. Les panneaux muraux n’ont plus de piquet ; le grand
titre est placé au-dessus des guichets. La texture respecte le rapport largeur /
hauteur de chaque panneau et le texte revient à la ligne sans compression horizontale.

Les invitations, cartes de butin, notifications et cadres des treize mini-jeux
reprennent le vert profond, l’ivoire et les fines lignes dorées du carnet et de la
sélection. Leurs illustrations d’action sont conservées, les rayons tournants et
sceaux géants retirés. Les contrôles natifs, le focus clavier et le démarrage au
centre de l’arène restent identiques.

Le troll possède son propre modèle de moins de 600 triangles et six lots : épaules
massives, longs bras et grandes mains, oreilles, nez, yeux, défenses, pagne et massue.
Sa taille est directement modélisée, car la pose des habitants remplace l’échelle
racine. Le modèle partage les animations de marche, de parole et les réactions
physiques des habitants. Les contrôles couvrent les pieds, la silhouette, les quatre
membres, le budget et la libération des instances.

Validation de cette passe : vues desktop et mobile de neuf biomes, des trois salles,
des approches et sorties et de la jonction suivante (17 positions par appareil),
plus gros plans et cadrages larges du village, moulin, monument et troll. Les captures
et mesures sont dans `.qa/coherence/`. Les tests navigateur conservent le plafond
mobile de 150 k triangles sur leurs compositions ; ces mesures Chrome avec viewport
mobile ne constituent pas des mesures de fréquence sur un téléphone physique.
