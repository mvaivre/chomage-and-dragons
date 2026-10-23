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
la profondeur, sauf les mares et les rivières franchies par des ponts ; les montées
longitudinales et les collines arrière sont conservées. Des bandes de sol grossières
prolongent visuellement l’avant et l’arrière jusqu’à la brume, sans étendre le parcours.

Le dessous est fermé par des bandes lisses qui suivent l’altitude du parcours. À
chaque abscisse, les deux faces se terminent exactement à cette même altitude,
1,6 m sous le niveau de la route. La face arrière peut être plus haute selon le
relief ; elle ne descend jamais sous le fond de la tuile. Les cours d’eau restent
contenus au-dessus de ce fond. Trois couches — surface, terre et roche — habillent
les coupes. Les coordonnées globales garantissent la jonction entre tronçons.

Deux rangées de plantations, dont une le long du bord arrière, évitent les trous de
décor dans les virages et les descentes. Une grille de 0,5 m ne produit que les
faces exposées. Les fleurs, fougères et petits rochers restent bas ; quelques bosquets, champignons,
cactus et colonnes de basalte plus hauts ponctuent le premier plan. Une fenêtre
d’occlusion protège la lecture du personnage à travers ces volumes.

Cinq tronçons au maximum suivent la caméra. Les tronçons initiaux sont prêts avant
la première image ; ensuite, un nouveau tronçon est généré par image. La brume
masque les extrémités longitudinales et les prolongements en profondeur. Les
chunks quittant la zone libèrent leurs géométries et leurs buffers d'instances.
Les matériaux et le cube de base sont partagés.

L’ORP, l’usine et la taverne ont chacun une tuile intérieure dédiée. Le paysage
extérieur et ses habitants sont entièrement masqués : seuls la salle, ses figurants
et les joueurs présents dans cette salle sont rendus. Les murs et grands feuillages
restent présents lorsque la caméra passe derrière : leur shader ouvre une fenêtre
autour du héros plutôt que de supprimer des objets entiers. Les habitants,
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
modélisés. L’ORP conserve sa construction précédente. L’usine utilise aussi des
bandes de sol et de mur, avec la même altitude et des variations de teinte dans le shader.

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

L’usine réserve une allée de 4,4 m, avec un dégagement à chaque porte. Les cinq
presses et leurs bureaux sont placés au fond ; les tas de CV restent bas au premier
plan. Les positions des machines et des employés viennent du même plan
`voxel/factory.ts`. Un test confronte les volumes réels des meubles aux 15 héros,
avec leurs accessoires, trois files, huit orientations et plusieurs poses de marche,
sur toute la traversée. Les tests navigateur suivent aussi les volumes animés lors
de l’entrée réelle, du coffre, du passage devant la première presse et du retour.

Les engrenages tournent, quinze CV imprimés sont éjectés, passent au-dessus des
têtes et retombent sur leurs piles. Ils réutilisent un seul lot de 60 cubes minces,
soit 720 triangles, sans création de particules ni ombres projetées supplémentaires.
Cinq ouvriers en tablier et coiffe de papier lèvent puis abaissent leur tampon ;
l’empreinte rouge apparaît sur le CV au moment de l’impact. Leurs cycles sont
décalés, les conversations suspendent le geste et les animations respectent la
pause et les mouvements réduits. Chaque ouvrier coûte moins de 400 triangles et
trois lots. La simplification du sol et du mur réduit le coût total de la salle,
malgré les nouvelles animations. Le test navigateur impose moins de 20 k triangles
sur la vue mobile intérieure contrôlée, sans shadow map ; le plafond extérieur de
150 k sur les trajets testés reste inchangé. Captures : `.qa/factory/`.


## Diversité, cours d’eau et occlusion — octobre 2026

`layout.ts` réserve les emprises complètes avant les plantations, feuillage compris.
Quinze nouvelles vignettes sont réparties sur les neuf biomes du premier tour :
enclos animé, cabane isolée, mangroves à racines, champignons géants, maison sur
pilotis, cabanes de pêcheurs, ruines, hameau avec place et fontaine, refuge alpin,
enclos à chèvres, oasis, forge, obsidienne et vignes. Le village de départ reste
conservé. Les maisons reposent sur des soubassements de pierre adaptés au terrain ;
seules les maisons de marais et de pêcheurs utilisent des pilotis. Chaque vignette
reste sous 2 000 triangles et six appels de dessin. Les trois nappes de brume des
marais utilisent chacune un simple plan à bord adouci, sans texture ni calcul volumétrique.
Le cadrage des hauts ensembles utilise des mesures de relief mises en cache.

Le monument des larmes mesure environ huit mètres. Son socle élargi et son bassin
partagent leur emplacement avec la clairière, ce qui évite les arbres dans la
sculpture. Quarante-quatre segments d’eau et quatre petits remous bouclent sans
création continue de géométries. Quatre rivières creusées traversent forêt, marais,
lac et cascades ; des tabliers en bois suivent la pente de la route, avec les
rambardes hors du passage. Les reflets de courant sont également réutilisés.
Trois petits dragons volants, de moins de 400 triangles chacun, ont des ailes
articulées et des trajectoires bornées au-dessus du parcours. Ils ne remplacent
pas les dragons interactifs ni leurs règles.

`occlusion.ts` projette jusqu’à quatre fenêtres autour du héros suivi, des autres
joueurs proches et de la cible inspectée. Le fragment shader des décors opaques
retire progressivement les pixels dans un cercle adouci avec une trame 4 × 4.
Il vérifie la profondeur caméra et la hauteur au-dessus des pieds : les surfaces
derrière le personnage et son sol restent opaques. La transition est spatiale,
continue avec la caméra et le personnage ; elle ne repose pas sur la disparition
brutale des objets. Le masque réutilise la passe opaque existante, sans cible de
rendu, texture, tri transparent ou raycast par objet. Les ombres gardent leur forme.
Les pièces, arbres, bâtiments de décor et terrain surélevé utilisent la même règle.
L’injection se fait par les points d’extension documentés de
[Three.js Material](https://threejs.org/docs/pages/Material.html), avec une clé de
programme distincte pour chaque variante.

Validation : 157 tests unitaires, dont des contrôles sur trois tours des emprises
réelles, des animations bornées, des canopées, de la libération des ressources,
des rivières, du masque devant/derrière et du cadrage des villages surélevés.
Les captures du vrai jeu couvrent 22 positions en compositions bureau/mobile,
avec vues larges et retournées sur les ensembles représentatifs. Le passage mobile
initial a mesuré une pointe de 121 402 triangles et 137 appels ; les scènes marais,
lac, montagne, désert et volcan vont d’environ 47 k à 108 k. Ces mesures sont celles
de Chrome avec émulation tactile, viewport 390 × 844 et DPR matériel 3 limité à 1,
pas celles d’un téléphone physique. Les tests navigateur conservent le plafond de
150 k triangles / 200 appels, l’absence de shadow map et le respect des sauvegardes.

La régression navigateur du masque compare les pixels réellement rendus sur une
scène figée : derrière le même arbre, le barde passe de 0 à 1 084 pixels roses
visibles quand le masque est activé. L’arbre reste chargé dans les deux cas.
Le parcours mobile de régression après les corrections de cadrage atteint
123 794 triangles et 130 appels au maximum ; les retours forêt/volcan et les
scènes intérieures passent également les budgets. Les 13 mini-jeux, les rites,
les coffres, les collisions et les portes ont été rejoués sans erreur.

Les raccords de terrain ferment aussi les différences de hauteur inférieures à un
centimètre. L’ancien seuil omettait ces faces et laissait de fines fissures visibles
en caméra arrière. Un test vérifie les arêtes partagées de la géométrie réelle ;
la fermeture ajoute environ 2 400 triangles à la pointe du parcours mobile testé,
qui reste sous 124 k.


## Miniature, profondeur de champ et relief prolongé

`miniature.ts` utilise la [texture de profondeur de Three.js](https://threejs.org/docs/pages/DepthTexture.html)
du rendu principal, sans redessiner les objets. La zone nette suit le héros ou la
cible inspectée. Le flou commence à 2,8 mètres de différence de profondeur caméra
et atteint son maximum à 11 mètres, à l’avant comme à l’arrière. Deux filtres à
résolution réduite alimentent une composition avec l’image nette ; le centre net reste
à la résolution originale. Le filtrage limite la diffusion des détails nets dans le
fond flou. Le HUD et les dialogues DOM restent nets.

La configuration actuelle utilise une caméra en perspective téléobjectif à 64 m,
avec décodage non linéaire de la profondeur GPU. `frameRoadPerspective` conserve le
chemin au centre de la zone utilisable malgré les barres d'interface, le zoom et
l'orbite. La mise au point suit le personnage ou l'objet inspecté.

Le flou est désormais indépendant du bouton des effets lumineux : mi-résolution
sur le profil élevé, quart de résolution sur le profil équilibré/mobile. Le bloom
et les ombres dynamiques restent coupés sur mobile. Le profil faible coupe aussi
le flou et ramène les buffers à 1 × 1 ; la baisse automatique conserve ce repli.
Les trois dessins plein écran ajoutent trois triangles par image, sans redessiner
les modèles. Le pourtour utilise un fond presque noir, légèrement teinté par le
biome ; la brume rejoint cette même couleur entre 18 et 31 m, avant la fin de la
zone chargée. Le flou dépend de la profondeur des objets, pas d'un dégradé vertical.

La brume utilisait sa couleur linéaire après la conversion de l’image vers sRGB :
le rendu direct produisait donc un halo sombre, différent du ciel. Sa couleur passe
maintenant par la conversion correspondant à la cible de rendu. Un test GPU
compare les pixels du ciel et ceux d’une géométrie complètement embrumée, en
rendu direct et HDR, sur trois palettes de jour et de nuit : les valeurs sont
identiques. Le brouillard de distance reste une légère transition colorée pour
masquer la limite du chargement ; il ne produit plus un voile noir.

Le prolongement visuel se raccorde à la hauteur exacte de la dernière colonne
voxel, puis redescend avec une courbe douce sur 16 mètres. Les marches des colonnes
se fondent dans une surface continue sur les quatre premiers mètres. Les profils
qui se croisent sont triangulés à leur intersection pour éviter les trous. Quelques
arbres, rochers et plantes prolongent le décor, sans étendre le parcours jouable.
Le relief central, les clairières et les distances des sauvegardes sont conservés.

Validation : 159 tests unitaires et régression navigateur sur les neuf biomes,
les intérieurs, les interactions et les 13 mini-jeux. La comparaison du vrai jeu
avec/sans profondeur de champ réduit l’énergie des détails lointains d’environ
31 %, tout en conservant 1 084 / 1 085 pixels roses du héros. Le parcours mobile
émulé atteint 131 698 triangles et 135 appels en pointe, sous les plafonds
150 k / 200. Ces mesures ne sont pas un benchmark de téléphone physique.

### Road-centred camera and volcanic terrain correction

The road, including its interior approach path, is now the camera anchor. Background
vignettes can widen the default view but never raise its target towards their roofs.
The orthographic UI inset is divided by zoom, so the road remains at the centre of
the usable screen during zoom and orbit. Object inspection temporarily retains its
own target. `roadFrustum` and the real browser projection regression cover desktop,
mobile, multiple zooms and camera angles.

The previous volcanic cone was added on top of an eight-metre shoulder immediately
behind a depressed lava channel. This produced a sheer wall. The volcanic slice now
has a single broad ridge, a graded forge terrace, an open dragon shelf, and three
irregular lava basins. Its foreground has shallow ash undulations, basalt clusters,
sulphur, charred scrub and one small animated skink per volcanic chunk. Those props
continue onto the shoulder using its actual sampled surface height. Other biomes'
height fields and distant landscape grammars remain unchanged.

Terraces in the volcanic slice and its immediate transitions use shared longitudinal
vertices. They retain stepped cross-slopes without the narrow vertical risers along
every road-altitude sample. Outer shoulders use a continuous shared grid and short
boundary stitching; there are no long tapered faces between shoulder columns. Tests
check slope limits, forge ground contact, lava/path separation, finite vertices,
triangle winding, matching chunk boundaries and resource release.

Visual comparison covered the volcano at close desktop, mobile, wide and reverse
compositions, plus the village camera regression. In Chrome mobile emulation the
nine-biome traversal peaked at 131,378 triangles and 135 draw calls; the volcanic
capture at 166 steps used 68,609 triangles / 104 calls. Mobile still has no bloom,
depth of field or shadow map. These are emulated-device measurements, not timings
from a physical phone.

### Continuous ground detail audit

See [the decor audit](DECOR_AUDIT.md) for the before/after survey of nine biomes,
eight transitions and three interiors. `terrain-surface.ts` applies world-space grain
to both the fine ground and the coarse continuation; its per-vertex surface mask
excludes water. There is no bitmap or extra surface geometry. `shoulder-cover.ts`
uses the existing opaque cube material and a continuous density envelope for low
vegetation and stones. These details use separate front/back batches so their
bounds cannot force dense near-ground foliage to render outside the camera view.
The shared surface sampler follows the actual triangles and river levels.

### Clôture du relief et du rendu miniature — 22 octobre 2026

Les observations et chiffres historiques ci-dessus précèdent cette dernière passe.
Le maillage central partage désormais ses sommets dans les deux axes : les pentes
facettées remplacent les risers répétés. Le grain procédural conserve les détails
voxel sans multiplier les triangles. `terrainHeight` décrit le champ sculpté et
nivelé ; `terrainSurface` échantillonne exactement les triangles rendus pour placer
les objets. Le prolongement partage la hauteur de sa bordure avec ce maillage.

`sites.ts` décrit les emprises sans interroger la hauteur du terrain. Les maisons
ordinaires disposent d'une plate-forme nivelée avec un raccord doux sur 4,5 m ; les
cabanes de pêche gardent leurs pilotis. Les rivières varient en largeur et en axe,
avec un méandre réduit au passage des ponts. Les objets narratifs utilisent une
berge sèche et partagent leur réservation avec le générateur d'arbres.

Validation finale : 172 tests unitaires, lint, build de production, parcours des
neuf biomes, huit transitions et trois intérieurs sur ordinateur et mobile, plus
vues inversées et rapprochées. Le parcours émulé culmine à 122 780 triangles /
144 appels ; les captures de parties réelles atteignent 125 616 / 147. Le flou
mobile utilise 98 × 211 pixels pour ses deux filtres sur une fenêtre 390 × 844,
sans bloom ni ombres. Cela vérifie des budgets et le rendu, pas les FPS d'un
appareil physique. Voir [l'audit complet](DECOR_AUDIT.md) et ses captures.

### Bâtiments visibles et franchissement des portes — 22 octobre 2026

Les portails utilisent désormais `entrances.ts` : grand centre ORP en pierre avec
colonnes et horloge, usine à CV avec toiture métallique et cheminées, taverne à
colombages. Les façades mesurent environ neuf mètres de large. Les murs encadrent
une ouverture réelle de deux mètres ; la porte pivote vers l'intérieur. Les
enseignes utilisent une typographie agrandie, sans déformer le texte.

La route extérieure s'arrête avant chaque zone intérieure. Une allée pavée de huit
mètres suit exactement `journeyPoint` jusqu'au seuil. Les herbes sont exclues de
cette courbe et les coffres suivent ses coordonnées X et Z. Les emprises du bâti,
du nivellement du terrain et des arbres partagent `portalFootprint`. Les maisons
du village aux tours suivants évitent aussi la sortie de la taverne. Seules les
vignettes forestières empêchées par les nouveaux bâtiments élargissent leur recherche
d'emplacement ; les autres paysages gardent leurs positions précédentes.

Le cadrage s'élargit progressivement à l'approche des entrées, y compris sur mobile,
en conservant la cible sur le chemin. Le personnage passe le seuil avant la coupure
sous fondu ; l'intérieur dédié est affiché quand le fondu est opaque. Cette étape
s'applique aussi en déplacement inverse et avec les animations réduites : les portes
s'ouvrent alors immédiatement, mais le franchissement n'est plus supprimé.

Contrôles : modèle et ouverture réelle par lancer de rayon, emprises et allées sur
plusieurs tours, entrée / sortie et annulation des trois bâtiments dans les deux
modes d'animation, présence réelle des façades dans la liste de rendu GPU et cadrage
des portes sur ordinateur et téléphone émulé. Captures : `.qa/entrances/final/`.

Validation de cette passe : 175 tests unitaires, lint et build réussis. Les 12
trajets entrée/sortie/annulation (trois bâtiments, deux modes d'animation), plus
le scénario parent et le contrôle des trois façades sur ordinateur/mobile,
passent les 14 vérifications navigateur des portes. Les contrôles de cadrage,
d'occlusion, des neuf biomes et de streaming restent valides. Les captures
mobiles des entrées culminent à 142 210 triangles et 154 appels, sans shadow map ;
le parcours des biomes atteint 130 684 triangles et 162 appels. Émulation Chrome,
pas mesure de FPS sur un téléphone physique.

### Interface et iconographie voxel — 22 octobre 2026

`voxel-icons.ts` décrit 40 petits modèles isométriques en volumes et trois faces
ombrées par volume. Le composant `VoxelIcon` les dessine en SVG, dans le même cadre
optique de 64 unités ; chaque modèle reste sous 120 faces. Ces symboles n'ajoutent
ni canvas WebGL, ni texture, ni boucle d'animation. `art.ts` partage la correspondance
entre actions, pouvoirs, mini-jeux et modèles ; les anciens chemins bitmap ont été
retirés du catalogue. Les identifiants enregistrés des réactions sociales restent
inchangés ; seul leur rendu remplace les emojis, avec des libellés accessibles.

Les actions ont trois lignes communes — icône, libellé et gain — à toutes les
largeurs contrôlées. Les illustrations des coffres, couronnes, objets cachés et
récompenses, ainsi que les icônes des 13 quêtes, du son et des réactions, utilisent
la même famille. L'atlas de la compagnie est désormais dessiné en SVG voxel ; les
positions sauvegardées des joueurs et leur déplacement depuis la carte restent
inchangés.

`ui-icons.css` harmonise les derniers panneaux parchemin/comiques avec le carnet
vert sombre : classement et scores, butins, rendez-vous, découvertes, récapitulatifs,
notifications et jeux textuels. Le carnet du personnage et l'inventaire n'ont plus
de débordement horizontal sur téléphone. Les colonnes du classement réservent
explicitement leur place au nom, au verre et au nombre de pas. Les commandes caméra
restent au-dessus du bandeau d'actions.

Validation : 176 tests unitaires, lint et build réussis. Douze vérifications navigateur
couvrent l'alignement à 320, 390, 844, 900 et 1280 pixels, les 13 mini-jeux dans les
deux formats, les reliques et l'inventaire, les saisies clavier, la sélection 3D,
les rites et le cadrage réel. Aucun chargement d'ancienne illustration `/art/` dans
le parcours UI ; les tests d'entraînement vérifient aussi que la sauvegarde reste
intacte. Captures des fenêtres : `.qa/ui-voxel/final/` ; accueil, rites, découverte,
récompense et invitation : `.qa/ui-voxel/flows/`.

### Exploration stable et disparition progressive — 22 octobre 2026

Le cadrage automatique des grands décors et des entrées est conservé en suivant le
personnage. En exploration libre (Shift-glisser ou flèches), `ExplorationZoom` fige
l’échelle effectivement visible ; seuls les gestes explicites de zoom la modifient.
Le retour « Mon personnage » rétablit le cadrage habituel. Les inspections de panneaux
et de PNJ continuent à disposer de leur zoom temporaire.

La transition vers le fond sombre s’étale sur 13 m (18 à 31 m), avec une ondulation
lente ancrée dans les coordonnées du monde. Sa modulation s’annule aux extrémités :
la zone proche reste intacte et le bord chargé reste complètement masqué. Aucun
maillage, texture, transparence ni passe de rendu supplémentaire ; l’effet miniature
et son rayon de flou réduit restent inchangés.

Contrôles : régression Shift traversant plusieurs biomes et deux intérieurs, zoom
manuel et retour au personnage ; lecture GPU du fade à plusieurs distances et angles,
contrôle du fond en rendu direct/HDR et de la continuité du grain. Comparaison visuelle
sur ordinateur rapproché, mobile et vue large : `.qa/exploration-fade/`.

### Labels synchronisés et optimisation de la boucle — 22 octobre 2026

Les coordonnées des noms et des cibles interactives étaient publiées toutes les
100 ms via un état React, alors que la scène dessinait plus souvent. La régression
navigateur reproduisait 5 mises à jour du nom pour 20 images pendant un zoom.
`WorldLabelLayer` conserve maintenant les mêmes nœuds DOM et applique leur transform
à chaque image du monde. Le texte et les attributs accessibles ne sont modifiés
que lorsque leur contenu change ; une délégation de clic unique utilise toujours
la cible actuelle. Les noms suivent la hauteur et la transformation du personnage,
y compris sa taille et son écrasement. Aucun React render pour déplacer un label.

La boucle utilise des échéances (`FramePacer`) plutôt qu’un seuil de 32 ms : objectif
60 images/s sur le profil élevé, 30 sur les profils mobile/repli, 10 en pause et
aucun dessin dans un onglet caché. Le rythme est testé à 60/90/120/144 Hz, sans rafale
de rattrapage après une longue suspension. La simulation conserve son delta réel et
ses sous-pas de physique. Les effets, plafonds géométriques et budgets mobiles sont
conservés.

Les calculs répétés sont réduits à plusieurs niveaux :

- Une mise à jour des matrices de la scène, réutilisée pour projeter les labels,
  sélectionner les lumières et dessiner. Les transformations animées restent actives.
- Les dimensions du HUD sont mesurées sur invalidation/ResizeObserver ; les lectures
  de layout et recherches DOM par image sont supprimées. Le cadrage tient compte
  du véritable HUD, y compris après changement de taille ou d’identité.
- `SceneObjects.revision` invalide la découverte des cibles lors d’un ajout, d’une
  suppression, d’un remplacement ou d’un changement de pièce. Les déplacements des
  mêmes PNJ réutilisent leurs références, avec une projection actuelle à chaque image.
- Les hauteurs exactes des nœuds du sol utilisent douze buckets spatiaux Float64
  bornés à environ 168 KiB. Le cache des seuils de porte reste borné à 64 pièces ;
  un seuil n’est évalué que sur l’allée concernée. La personnalisation des panneaux
  est recalculée au changement de données ou de tour, pas à chaque image.
- La sélection des deux/quatre lumières réutilise des candidats et vecteurs fixes,
  sans tableau de toutes les sources ni tri complet. Les sources libérées ne restent
  pas référencées par les candidats.
- Les empreintes de contact téléversent uniquement les instances/alphas modifiés.
  Un sol statique ne provoque plus un upload complet des buffers à chaque image.
- Les relevés détaillés (géométries, bounds, PNJ, décors) sont évalués à la lecture.
  En production, les diagnostics sont absents sans `?debug`/`?profile`. Le compteur
  visible de l’atelier n’est rafraîchi qu’en cas de changement, au plus deux fois/s.

Comparaison locale Chrome/Metal, quatre scènes stables, fenêtres de trois secondes,
mêmes tailles et profils, un joueur. `ScriptDuration / images` inclut l’overlay ;
ce n’est ni un temps GPU ni un benchmark de téléphone physique. Le profil CPU ajoute
un surcoût aux deux mesures ordinateur forêt/volcan.

| Vue | Script/image ordinateur avant → après | Script/image mobile émulé avant → après |
| --- | --- | --- |
| Village | 1,72 → 1,16 ms | 1,60 → 1,20 ms |
| Forêt | 1,67 → 1,13 ms | 1,38 → 1,08 ms |
| Volcan | 1,69 → 1,20 ms | 1,32 → 0,97 ms |
| Taverne | 1,24 → 0,87 ms | 1,20 → 0,92 ms |

La cadence médiane ordinateur passe de 33,3 à 16,7 ms. Le téléphone émulé reste à
33,3 ms avec son budget d’énergie. Les recalculs de layout observés passent de
9–24 par fenêtre à zéro (le volcan mobile était déjà à zéro). Les triangles restent
comparables ; les légères différences de culling sur ordinateur viennent du cadrage
dans le HUD réel. Les noms plus fréquents n’ajoutent aucun triangle. Sources brutes :
`.qa/perf-deep/before.json`, `.qa/perf-deep/after.json` ; script de mesure dans le même
dossier. Les valeurs de heap sans GC forcé ne mesurent pas une fuite.

Validation finale : 181 tests unitaires et les 53 vérifications navigateur des
scènes/interactions (scénarios parents inclus), lint, TypeScript et build de production.
Les tests du PNJ mobile cliquent désormais son centre avec un vrai pointeur : attendre
que son hotspot soit immobile pendant deux images ne convient plus à une projection
synchronisée. L’assertion d’icône du test de rechargement utilise le SVG voxel actuel.
Le test des noms observe 38/38 mises à jour sur ordinateur et 20/20 sur téléphone émulé
pendant un zoom, sans remplacement du texte. Le build lancé localement a aussi été
contrôlé sur les deux formats, avec des noms visibles et sans diagnostic global hors
mode debug. Captures : `.qa/perf-deep/production-desktop.png` et `production-mobile.png`.
