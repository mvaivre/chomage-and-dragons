# Décor vivant — septembre 2026

## Assets et provenance

Créés avec **l’outil ImageGen intégré**, sans CLI de génération. Les prompts exacts,
sources retenues et chemins finaux figurent dans [ambient-prompts.json](ambient-prompts.json).
Les fichiers consommés par le jeu sont tous dans le dépôt :

| Fichier sous `public/art/world-v3/` | Usage |
| --- | --- |
| `runtime/plaine-back-animated.webp` | Plaine avec le grand rotor et le fanion retirés, support reconstitué |
| `runtime/windmill-rotor.webp` | Quatre ailes indépendantes, pivot central |
| `runtime/windmill-flag.webp` | Fanion extrait de l’ancien paysage, 36 × 31 px |
| `runtime/taverne-mid-animated.webp` | Taverne sans poule, lanternes, flamme ni fumée incorporées |
| `animations/gnomes.webp` et `.json` | Deux petits gnomes, quatre poses chacun |
| `animations/tavern-life.webp` et `.json` | Poule couronnée, lanterne, flamme, fumée, touffe d’herbe |

Les anciennes planches restent disponibles pour comparaison. Les paysages lointains
`*-far.webp` sont conservés. La ligne de l’employé à capuche de `ambient.webp` n’est
plus utilisée ; les autres animaux de cette planche restent actifs.

```sh
node scripts/compile_ambient_assets.mjs SOURCE.png DESTINATION.webp atlas
# Autres modes : plaine, tavern, rotor.
node scripts/compile_ambient_assets.mjs public/art/world-v3/runtime/plaine-back.webp public/art/world-v3/runtime/windmill-flag.webp flag
```

L’import conserve l’alpha fourni par ImageGen. Pour les exports RGB contenant un
damier peint, il supprime seulement le fond neutre connecté à l’extérieur, puis
conserve le repérage des cellules et la ligne de pieds. Les images originales de
génération ne sont pas modifiées. La validation visuelle reste nécessaire : le
détourage ne garantit pas à lui seul un bon raccord artistique.

## Animation et profondeur

- Le rotor tourne lentement autour de l’axe du moulin. Le fanion se déforme depuis
  son mât. Le petit moulin distant reste peint pour préserver le paysage validé.
- La poule cligne des yeux, incline la tête puis donne un bref coup d’aile, avec de
  longs repos. Les lanternes pivotent autour de leur suspension ; leur lumière,
  la flamme et deux petites bouffées de fumée ont des rythmes différents.
- Les gnomes, nettement plus petits que les héros, lèvent une chope ou balaient.
  Ils sont placés au bord arrière du chemin, après sa frange d’herbe et avant les
  joueurs. Une petite ombre assure leur contact au sol.
- Quelques touffes se courbent depuis leurs racines. Huit reflets suivent les
  deux chutes d’eau déjà dessinées dans la cascade.

Les pièces du moulin et de la taverne utilisent les coordonnées de leur image
support et héritent de sa parallaxe, de son échelle et de son éventuel miroir.
Les gnomes et touffes suivent la profondeur du plan intermédiaire.

## Coût et vérification

Les deux nouvelles planches font 1024 × 640 px chacune (~2,5 Mio RGBA par planche).
Les poses partagent leur texture GPU ; les halos et reflets sont construits une
fois. Les ticks modifient les transforms ou la texture du sprite, sans état React
par image. Le fanion isolé évite de garder l’ancien paysage entier en mémoire.
Les composants ne progressent que près du champ visible et le ticker général
reste suspendu derrière les écrans superposés ou quand la page est cachée.
La préférence de réduction des animations fige les poses et retire les reflets
mobiles et la fumée.

Validation du moulin et des gnomes en jeu avant extension à la taverne : vues
rapprochées, portrait 390 px et large 1920 px. Taverne inspectée aux mêmes formats ;
cascade inspectée aussi à 320 px. Vérifications des pieds, attaches, silhouettes,
transparence, ordre des plans et absence d’erreurs JavaScript. Tests automatisés
des cellules transparentes, de la registration des pieds et des séquences de poses.
Les captures navigateur utilisent Chromium avec rendu logiciel ; elles ne
constituent pas une mesure de fluidité sur téléphone physique.
