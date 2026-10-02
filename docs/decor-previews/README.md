# Contrôles du décor « vie et WTF »

Les JPEG sont une sélection des captures dans le vrai jeu, avec Chrome et WebGL
Metal sur Apple M1 Max. Les PNG à la racine sont les planches-contact des 25 images,
plus le contrôle des rectangles des panneaux et la référence réunie des paysages.
Aucun de ces fichiers de contrôle n’est chargé par le jeu.

## Avant et après

| Étape | Capture |
| --- | --- |
| Référence, plaine mobile | [Avant](baseline/0-390x844-12.jpg) |
| Lot 1, foule et panneaux de secours | [Plaine](lot-1-plaine-final/19-390x844-12.jpg) |
| Lot 2, illustrations | [Plaine](lot-2-foret/1-390x844-12.jpg), [bois](lot-2-foret/45-390x844-22.jpg) |
| Lot 2, autres contrées | [Marais](lot-2-monde/54-390x844-22.jpg), [péage](lot-3-orp-final/80-390x844-12.jpg), [cascade](lot-2-monde/104-390x844-22.jpg), [échelle](lot-2-monde/128-1280x720-12.jpg), [mirage avant approche](lot-4-mirage-final/150-390x844-12.jpg), [désert après approche](lot-2-monde/152-1920x1080-22.jpg), [afterwork](lot-3-orp-final/180-390x844-22.jpg) |
| Lot 3, ORP | [Entrée](lot-3-orp-final/7-390x844-12.jpg), [guichet de nuit](lot-3-orp/14-390x844-22.jpg), [sortie large](lot-3-orp-final/18-1920x1080-22.jpg) |
| Lot 3, usine | [Entrée large](lot-3-factory/29-1920x1080-12.jpg), [machines](lot-3-factory/34-390x844-12.jpg), [paysage](lot-3-factory/34-844x390-12.jpg), [sortie de nuit](lot-3-factory/40-390x844-22.jpg) |
| Lot 4 | [CV](lot-4-cv/60-390x844-12.jpg), [pigeon](lot-4-pigeon-caption/60-390x844-22.jpg), [nuage](lot-4-cloud-final/60-390x844-12.jpg), [enseigne nocturne](lot-4-office/180-390x844-22.jpg) |

Les étapes antérieures aux intérieurs montrent volontairement la route d’origine.
Les arrêts de scène ne sont pas tous exactement au même pas ; le nom du JPEG donne
le pas, le viewport et l’heure. Un élément peut entrer ou sortir du cadre mobile
pendant le parcours : le monde conserve ses coordonnées au changement de format.

## Rejouer

Après `pnpm build --webpack`, lancer `pnpm start --port 3123`, puis :

```sh
DECOR_STEPS=7,10,14,18 DECOR_PERF=0 node scripts/decor-qa.mjs orp
DECOR_STEPS=29,34,40 DECOR_PERF=0 node scripts/decor-qa.mjs usine
DECOR_EVENT=pigeon DECOR_STEPS=60 DECOR_PERF=0 node scripts/decor-qa.mjs pigeon
DECOR_EVENT=office DECOR_STEPS=180 DECOR_PERF=0 node scripts/decor-qa.mjs enseigne
DECOR_STEPS= DECOR_PERF_STEP=2 node scripts/decor-qa.mjs perf
```

Formats par défaut : 1280 × 720, 390 × 844, 320 × 568, 844 × 390 et 1920 × 1080,
chacun à 12 h et à 22 h. `DECOR_SIZES=390x844,1920x1080` restreint une retouche.
`DECOR_EVENT` accepte `cv`, `pigeon`, `cloud`, `office` et fige uniquement l’horloge
du navigateur de test pour voir un événement rare. Le stockage est isolé : aucun
vrai groupe n’est modifié. Les fichiers `results.json` conservent chaque matrice
et les erreurs JavaScript ; seuls quelques JPEG sont versionnés pour limiter le poids.

Les mesures de performances et leurs limites sont détaillées dans
[RENDERING.md](../RENDERING.md). Le protocole relève le CPU du renderer via CDP sur
cinq secondes au repos, puis les intervalles entre frames sur 4,3 secondes autour
d’un refus. Le mobile simule un CPU ralenti quatre fois ; ce n’est pas un téléphone
physique. Les mesures finales sont exécutées sans autre test ni build en parallèle.
