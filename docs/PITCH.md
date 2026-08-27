# LOUCHÔMAGE — Pitch initial

> Document de référence. Capture des idées initiales telles que formulées au départ.
> Statut : vision complète, **pas** un backlog. On construit par étapes, en partant du plus simple.

## Concept

Jeu web humoristique entre ami·es pour rendre la recherche d'emploi plus amusante.
Principe inversé : **plus on se fait recaler, plus on gagne de points**. Plus on accumule
de points, plus son personnage avance sur une carte d'aventure.

## Enjeux et récompenses

Il existe **deux classements strictement indépendants**. C'est le mécanisme d'équité
central du jeu, pas un détail cosmétique.

### 1. Le titre de saison — LA LÉGENDE DU CHÔMAGE 🏆

- **Cumule tous les points depuis le début de la saison.**
- Le/la vainqueur·e se fait inviter à manger par tout le monde.
- Échéance : **fin de saison, par défaut le 31 décembre**, mais la date doit être un
  **paramètre configurable** (« on pourrait déterminer une date »). Idem pour la date
  de début. Objectif : pouvoir relancer une saison 2 sans toucher au code.
- Arriver tard dans la saison est un désavantage assumé sur ce classement.

### 2. La Couronne du mois — Roi/Reine des chômeurs du mois 👑

- **Remise à zéro le 1er de chaque mois. Ne cumule rien du mois précédent.**
- Le/la vainqueur·e du mois se fait payer un verre.
- **C'est le correctif d'équité** : quelqu'un qui arrive au chômage en septembre est à
  égalité parfaite avec les autres pour la Couronne de septembre, même si les autres
  jouent depuis janvier. C'est le lot accessible aux arrivant·es tardif·ves.
- Les couronnes mensuelles passées sont conservées et affichées (palmarès).
- **Points bruts, pas de normalisation.** Même pour le mois où quelqu'un arrive en
  cours de route (ex. le 25 du mois). Décision assumée : la lisibilité du classement
  passe avant la justice mathématique. La personne joue sa vraie chance dès le mois
  suivant.

Deux occasions de fête, une seule victoire qui compte vraiment.

## Univers visuel

Deux univers étaient envisagés :

- 🕹️ **Retro-Arcade** — pixels, néons, high-score façon borne d'arcade 80's.
- 🧙 **Donjons & Refus** — parchemin, dorures, ambiance jeu de rôle.

**Décision prise : on part sur Donjons & Refus (D&D).** L'arcade est écarté (peut-être
un thème alternatif plus tard, pas une priorité).

Spécificités du mode D&D :

- **Niveaux** : tous les 10 candidatures = +1 niveau.
  - Niveau 1 → 0–9 candidatures
  - Niveau 2 → 10–19
  - Niveau 3 → 20–29, etc.
- **Coffres au trésor** : se débloquent à 10, 20, 30… candidatures.
- **Événements aléatoires** tirés au sort (coup de chance, mini-boss RH, absurdités du
  recrutement). **Purement narratifs : ils ne touchent JAMAIS au score officiel.**
  C'est pour l'ambiance et les anecdotes.

## Actions principales (les boutons)

| Action | Points | Notes |
| --- | --- | --- |
| **Candidature** | +1 | Fait avancer le personnage. **Doit être annulable** (clic par erreur). Animation : pigeon voyageur qui part avec la candidature. |
| **Refus** | +1 | Animation : ⚡ éclair qui frappe le personnage, 💥 effet, 😵 personnage temporairement « électrocuté ». |
| **Entretien** | 3 (signe à confirmer) | « −3 points et un shot » dans le pitch d'origine — à clarifier. |
| **Rejet après entretien** | +5 | 💀 **LEGENDARY REJECTION** |
| **Engagé·e** | — | Le personnage quitte la course active, **mais les points accumulés restent**. La personne ne disparaît pas du classement. |

## Le Scoreboard

Un tableau qui additionne tout ce que le groupe a produit **collectivement** :
candidatures, refus, entretiens, « quand même » (rejets après entretien), embauches.
**Aucun bonus caché n'y rentre — que les actions officielles.**

## La Grande Course

Panneau montrant tous les avatars côte à côte sur un chemin d'aventure stylisé :

```
🌲 forêt → 🌊 eau → 🏔️ montagne → 🌉 pont → 🏁 arrivée
```

- Le décor change selon la **saison en cours**.
- La position dépend d'une **combinaison de trois facteurs** :
  1. le nombre de candidatures envoyées,
  2. le temps écoulé jusqu'à la deadline,
  3. le niveau (mode D&D).
- Conséquence voulue : **mener au score n'envoie pas automatiquement le personnage
  tout au bout du chemin.**

## Personnages

Chaque joueur·euse choisit son personnage en rejoignant le jeu :

🦄 Licorne · 🦩 Flamant rose · 🐋 Baleine · 🧜‍♀️ Sirène · 🐉 Dragon · 🦊 Renard ·
🦉 Hibou · 🐺 Loup · 🧙‍♀️ Magicienne · 🧝‍♂️ Elfe · 🧗‍♀️ Grimpeur·euse · 🦋 Papillon

## Animations (« les petites choses qui font tout »)

- 🕊️ **brieftaube** (pigeon voyageur) traverse l'écran à chaque candidature envoyée
- ⚡ **éclair** à chaque refus (flash + tremblement de l'écran, « électrifié par le rejet »)
- 🍸 **confettis + verre à cocktail** à chaque entretien décroché
- 🏆 **grande célébration** à chaque embauche
- 🧰 **effet « coffre débloqué »** à chaque palier de 10 candidatures (D&D)
- 🦅 / 👹 **effets distincts** selon le type d'événement aléatoire (chance vs mini-boss)

## Gestion des joueur·euses

- Ajouter / retirer des joueur·euses à tout moment.
- **Le jeu doit être flexible** : quelqu'un peut rejoindre la partie en cours de route
  (quand il/elle arrive au chômage) sans hériter de points.
- **Sa vraie chance de victoire, c'est la Couronne du mois**, qui repart de zéro chaque
  mois (voir « Enjeux et récompenses »). Le classement mensuel est la réponse à
  l'équité des arrivées tardives.

## Points à clarifier

1. **Entretien : −3 ou +3 ?** Le pitch dit « −3 points et un shot », mais l'entretien
   figure aussi dans le scoreboard des actions officielles. Malus (tu t'approches de
   l'emploi, donc tu perds au jeu du chômage) ou bonus ?
2. **Combien d'actions « officielles » ?** Le texte dit « les 4 actions officielles »
   mais en liste 5 (candidature, refus, entretien, rejet après entretien, embauche).
3. **Formule exacte de progression sur la course** (pondération des 3 facteurs).
4. **Confiance / triche** : tout le monde peut-il cliquer pour tout le monde, ou
   chacun n'agit que pour soi ?
