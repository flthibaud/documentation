---
title: Modèles de fiches
description: Squelettes de fiches technique, structure de données et cours.
sidebar:
  order: 3
tags: [meta]
---

Squelettes à copier dans un nouveau fichier.

## Fiche technique

Pour une procédure, un aide-mémoire, une configuration.

````markdown
---
title: 
description: 
tags: []
statut: brouillon
---

## Le problème

Ce que je cherchais à faire, et pourquoi la solution évidente ne marchait pas.

## La solution

```bash
# la commande qui marche
```

## Pourquoi ça marche

L'explication en trois phrases. C'est cette partie qui rend la fiche réutilisable
dans un contexte légèrement différent.

## Pièges

- 
````

## Fiche structure de données

````markdown
---
title: 
description: 
tags: [structure-de-donnees]
statut: brouillon
---

## En une phrase

## Représentation en mémoire

## Complexités

| Opération | Moyenne | Pire cas |
| --- | --- | --- |
| Accès | | |
| Recherche | | |
| Insertion | | |
| Suppression | | |

Espace : O(n)

## Implémentation

```python
```

## Quand l'utiliser

## Quand l'éviter

## Pièges classiques

- 
````

## Fiche de cours IUT

````markdown
---
title: 
description: 
tags: [iut]
statut: brouillon
---

## Notions du cours

## L'essentiel à retenir

Les trois ou quatre points qui tombent à l'examen.

## Exemples travaillés

## Exercices types

:::note[Corrigé]
La correction, repliée pour pouvoir réviser sans la voir.
:::

## Ce que je n'ai pas compris

````

## Bloc QCM

Demande une extension `.mdx` et un import. Le chemin relatif dépend de la profondeur du
dossier : `../../../components/quiz` depuis `technique/`, `structures-de-donnees/` ou `iut/`.

````mdx
import { Quiz, Question, Choix, Correction } from '../../../components/quiz';

## Se tester

<Quiz>
	<Question>
		L'énoncé, en Markdown — le `code` et les liens y passent.

		<Choix>Une réponse plausible</Choix>
		<Choix correcte>La bonne</Choix>
		<Choix>Une autre</Choix>

		<Correction>
			Pourquoi, et surtout pourquoi les autres sont fausses.
		</Correction>
	</Question>
</Quiz>
````

Une seule `<Choix correcte>` par question. Dans la source, l'ordre est toujours énoncé,
choix, correction.

Questions et choix sont **mélangés au chargement**, pour ne pas retenir « c'est la 2e ».
Deux échappatoires quand l'ordre porte du sens :

| Attribut | Effet |
| --- | --- |
| `<Quiz ordonne>` | fige l'ordre des questions (l'une s'appuie sur la précédente) |
| `<Question ordonnee>` | fige l'ordre des choix (échelle 1FN → 3FN, « aucune des deux ») |

`<Quiz titre="…">` change l'intitulé, « Vérifier » par défaut.

Les réponses sont dans le HTML servi — c'est de l'auto-évaluation, pas un examen.

## Créer une fiche en ligne de commande

```bash
cat > src/content/docs/technique/ma-fiche.md <<'EOF'
---
title: Ma fiche
description: 
tags: []
statut: brouillon
---

## Le problème

EOF
```
