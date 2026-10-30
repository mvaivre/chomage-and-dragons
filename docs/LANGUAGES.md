# Langues de l’interface

La langue est choisie sur l’accueil ou dans le dialogue d’entrée, avant le
chargement du jeu : français, allemand, anglais, espagnol et italien. La préférence
`louchomage:language:v1` est propre à l’appareil. Les anciens appareils sans choix
explicite voient le dialogue une fois. Le français reste la langue par défaut.

`src/lib/i18n/messages.json` contient les catalogues dans l’ordre anglais, allemand,
espagnol, italien. `overrides.json` contient les formulations relues, notamment les
règles, contrôles, étapes du tutoriel et noms des mini-jeux. Les catalogues sont
livrés avec l’application ; aucune requête de traduction n’est faite pendant une
partie. Pour ajouter un texte, appeler `t` avec sa phrase française et des paramètres
`{0}`, `{1}` : `t("Saluer {0}", [player.name], locale)`.

Les composants React utilisent `useLocale` pour une première hydratation stable et
les changements depuis le sélecteur. Les canvas traduisent les textes avant leur
mesure ou les font tenir dans leur espace logique. Les mots-clés affichés sont
traduits, tandis que les collisions et les graines restent calculées sur les
identifiants d’origine. Les dates visibles suivent la langue ; les clés mensuelles
et le fuseau de classement restent ceux de Zurich.

Ne jamais traduire les noms saisis par les joueurs, les mots de passe, PIN, slugs,
identifiants de classe ou d’action, ni réécrire des messages déjà sauvegardés. Les
textes français hérités sont traduits au moment de l’affichage, à partir de modèles.
La langue ne fait pas partie de l’état partagé ; deux membres peuvent choisir des
langues différentes sans modifier leur groupe ou sa progression.

Les tests `tests/i18n.test.mjs` vérifient la couverture des classes, mots-clés et
mini-jeux, l’intégrité des paramètres, les pluriels et les clés temporelles stables.
`tests/browser/languages-3d.test.mjs` couvre le choix, sa persistance, les deux vues,
les petits écrans et la conservation des noms et du journal.
