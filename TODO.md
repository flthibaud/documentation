# TODO

## Composants interactifs

Le QCM (`src/components/quiz/`) est en place. Suites possibles, par coût croissant.

### Spoiler / réponse cachée

`<Spoiler>` repliable pour un exercice à réponse ouverte, là où un QCM est trop rigide.
Remplace les `:::note[Corrigé]` qui sont visibles d'emblée.

Le moins cher des quatre : `<details>`/`<summary>` stylé, zéro JS.

### QCM à réponses multiples

Détectable sans nouvelle prop : plusieurs `<Choix correcte>` dans une `<Question>` →
bascule en cases à cocher + bouton « Valider ». `Question.astro` compte les
`[data-correcte]` au `connectedCallback` et change de mode.

Touche uniquement `Question.astro` et `Choix.astro`, l'API de rédaction ne bouge pas.

### Flashcard recto/verso

`<Carte>` avec question au recto, réponse au verso au clic, et deux boutons
« su / pas su ». Utile sur les fiches de définitions (complexités, formes normales).

Question ouverte : sans persistance, l'auto-évaluation ne sert qu'à la session en cours.
C'est le premier composant qui justifierait vraiment `localStorage`.

### Visualiseur de structure

Pile / file / tableau animés pas-à-pas (`push`, `pop`, `enqueue`, redimensionnement).
C'est ce qui manque le plus aux fiches `structures-de-donnees/`, et de loin le plus de
code — état, contrôles lecture/pause/étape, rendu SVG ou grille CSS.

À traiter comme un composant par structure plutôt qu'un moteur générique.

## Divers

- Bouton « recommencer » sur `<Quiz>` une fois toutes les questions répondues : refaire
  le quiz sans recharger la page.
- Persistance `localStorage` (score par fiche, cartes « su »), si le besoin de suivi
  apparaît. Prévoir un bouton de remise à zéro.
