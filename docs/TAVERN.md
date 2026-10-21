# LA TAVERNE

La dernière partie du parcours est une salle explorable, accessible par une vraie porte. Une embauche amène le personnage à l’intérieur, quelle que soit sa position dans le peloton ou son nombre de tours.

La fête réunit un trio de musiciens, un barde dont la capuche sert de réceptacle, trois danseurs sur une table, une cavalière de chandelier, un dragon qui boit, un acrobate en équilibre sur les mains, une princesse qui embrasse un ogre et un pigeon qui fait un moonwalk. Un mage prend un bain dans un tonneau en faisant léviter ses chopes.

Chaque scène répond au clic ou au clavier. Le chandelier oscille autour de sa chaîne, les danseurs bougent indépendamment de la table, le dragon a le hoquet et le pigeon possède quatre poses de pas. Les bougies ont des halos et un scintillement discret. La réduction des animations fige ces mouvements et conserve les dialogues.

## Découpage

Le fond et le sol se trouvent derrière les convives, eux-mêmes derrière le joueur. Les paysages extérieurs existants sont conservés. Les montants de bois masquent les raccords du mur. Le cadrage automatique conserve le personnage et les convives à l’arrivée, avec une vue décalée vers la fête sur téléphone.

La salle s’étend de `WORLD_LENGTH - 1840` à `WORLD_LENGTH + 100`. Elle traverse la limite du tour pour accueillir toutes les lignes d’arrivée, sans fausse porte à cette limite. Les bornes des intérieurs sont désormais absolues. La couronne cachée conserve son identifiant et se trouve près des lanternes avant l’entrée.

## Images et prompts

Création avec l’outil intégré **image_gen**, puis import déterministe avec Sharp. Les images sources sont conservées dans le dossier de génération Codex. Les prompts exacts et leurs références figurent dans [TAVERN_ART_PROMPTS.json](TAVERN_ART_PROMPTS.json).

Fichiers livrés, accompagnés de leurs métadonnées JSON :

- `public/art/world-v3/decor/exterior-tavern.webp` — façade et porte
- `public/art/world-v3/decor/interior-tavern-wall.webp` — mur de la salle
- `public/art/world-v3/decor/interior-tavern-cast-a.webp` — musiciens, barde, chandelier et danseurs
- `public/art/world-v3/decor/interior-tavern-cast-b.webp` — dragon, acrobate, couple et mage
- `public/art/world-v3/animations/tavern-pigeon.webp` — quatre poses du pigeon

Les groupes sont importés par régions dans `scripts/compile_tavern_assets.mjs` pour conserver les accessoires détachés. Le pigeon et la façade utilisent `scripts/compile_ambient_assets.mjs`. Aucun traitement d’image n’a lieu dans le jeu.

## Vérification

`tests/tavern.test.mjs` couvre l’arrivée des personnages engagés, la continuité entre les tours, les deux portes et le sens du moonwalk. `tests/browser/tavern.test.mjs` vérifie le rendu sur ordinateur, mobile et écran large, les neuf interactions, la sauvegarde, les mouvements, leur réduction et les passages de porte. Les tests existants couvrent les autres intérieurs, les silhouettes, les objets cachés et les animations des habitants.
