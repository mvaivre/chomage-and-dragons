# Le monument des larmes

Le monument voxel se trouve au bord du lac, à la distance sauvegardée `13600`.
La sculpture de pierre mesure environ huit mètres de haut, avec un diadème,
un visage sculpté, des gravures, de la mousse et un large bassin turquoise.
Son emprise de dix mètres par huit réserve une clairière avant la génération
des arbres. Le plateau est nivelé sous le socle, avec un raccord au relief.

Deux coulées partent des yeux et se courbent jusqu’au bassin. Les quarante-quatre
segments d’eau, leurs reflets et les quatre petits remous se réutilisent : aucun
objet n’est créé à chaque image. La pause et la réduction des mouvements sont
respectées. La pierre conserve sa géométrie fixe.

Le chemin, les coffres et les interactions existantes restent inchangés. Un bosquet
au premier plan apporte de la profondeur ; son shader ouvre une fenêtre adoucie
quand il se trouve entre la caméra et le héros. Le cadrage bureau s’élargit à
l’approche pour inclure le sommet du monument.

Implémentation : `voxel/tears-monument.ts`, site et cadrage dans `voxel/layout.ts`,
plateau dans `voxel/world.ts`, animation et chargement dans `voxel/engine.ts`.
Aucun bitmap de monument n’est chargé.

`tests/voxel-immersion.test.mjs` vérifie l’emprise réelle, les eaux animées,
la clairière et la libération des ressources. Les captures de contrôle du vrai jeu
sont dans `.qa/immersion/` : bureau, mobile, écran large et caméra retournée.
Le test navigateur d’immersion traverse les neuf biomes, vérifie les sauvegardes
et impose les budgets du profil mobile.
