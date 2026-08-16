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
