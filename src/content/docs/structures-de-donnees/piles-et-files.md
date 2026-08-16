---
title: Piles et files
description: LIFO, FIFO, et les parcours d'arbres et de graphes qui en découlent directement.
tags: [pile, file, structure-de-donnees, parcours]
statut: stable
sidebar:
  order: 3
---

## En une phrase

La **pile** ressort le dernier élément entré (LIFO), la **file** ressort le premier (FIFO).
Deux structures triviales, mais qui déterminent l'ordre de tous les parcours.

## Pile (LIFO)

```
push(3)     │   │      pop() → 3
            │ 3 │
            │ 2 │
            │ 1 │
            └───┘
```

| Opération | Complexité |
| --- | --- |
| `push` | O(1) amorti |
| `pop` | O(1) |
| `peek` | O(1) |

En Python, une simple liste suffit :

```python
pile = []
pile.append(3)     # push
sommet = pile[-1]  # peek
valeur = pile.pop()  # pop
```

### Où on en trouve

- **La pile d'appels.** Chaque appel de fonction empile un cadre, chaque `return` le dépile.
  Une récursion trop profonde la fait déborder : c'est le `StackOverflow`.
- **Annuler / refaire.** Deux piles : une pour les actions faites, une pour les annulées.
- **Vérifier des parenthèses équilibrées.** Le cas d'école :

```python
def equilibre(expression):
    paires = {')': '(', ']': '[', '}': '{'}
    pile = []
    for caractere in expression:
        if caractere in '([{':
            pile.append(caractere)
        elif caractere in paires:
            if not pile or pile.pop() != paires[caractere]:
                return False
    return not pile
```

- **Dérécursiver.** Toute fonction récursive peut être réécrite avec une pile explicite. Utile
  quand la profondeur dépasse la limite du langage.

## File (FIFO)

```
enfiler(4) →  [1][2][3][4]  → défiler() → 1
```

| Opération | Complexité |
| --- | --- |
| `enfiler` | O(1) |
| `défiler` | O(1) |

:::danger
Ne **jamais** implémenter une file avec `liste.pop(0)` : c'est en O(n), car tous les éléments
sont décalés. Une boucle de traitement devient un O(n²) silencieux.
:::

```python
from collections import deque

file = deque()
file.append(4)        # enfiler, O(1)
premier = file.popleft()  # défiler, O(1)
```

Une `deque` (*double-ended queue*) permet les deux bouts en O(1). C'est le bon défaut.

### Où on en trouve

- Files d'attente de tâches, tampons producteur-consommateur.
- Ordonnancement en tourniquet.
- Parcours en largeur d'un graphe.

## Le lien avec les parcours

C'est le point à retenir : **le même algorithme, avec une pile ou une file, donne deux
parcours différents.**

```python
def parcours(depart, voisins_de, en_profondeur):
    a_traiter = [depart]
    vus = {depart}
    while a_traiter:
        # pile → profondeur (DFS) ; file → largeur (BFS)
        noeud = a_traiter.pop() if en_profondeur else a_traiter.pop(0)
        yield noeud
        for voisin in voisins_de(noeud):
            if voisin not in vus:
                vus.add(voisin)
                a_traiter.append(voisin)
```

- **Pile → parcours en profondeur (DFS).** Descend au fond d'une branche avant de reculer.
  Utile pour détecter des cycles, trier topologiquement, explorer tous les chemins.
- **File → parcours en largeur (BFS).** Explore niveau par niveau. C'est ce qui garantit de
  trouver le **plus court chemin en nombre d'arêtes**.

## File de priorité

Variante importante : on ne sort pas le premier entré, mais **le plus prioritaire**.
Implémentée par un tas binaire, donc en O(log n) — voir la fiche
[Arbres](/documentation/structures-de-donnees/arbres/).

```python
import heapq

file = []
heapq.heappush(file, (2, "tâche moyenne"))
heapq.heappush(file, (1, "tâche urgente"))
priorite, tache = heapq.heappop(file)   # (1, "tâche urgente")
```

C'est le cœur de l'algorithme de Dijkstra et de A*.

## Pièges classiques

- **`pop(0)` sur une liste** — déjà dit, mais c'est l'erreur la plus fréquente.
- **Marquer les nœuds visités au mauvais moment.** En BFS, il faut marquer *à l'enfilement*,
  pas au défilement : sinon un même nœud peut être enfilé plusieurs fois avant d'être traité.
- **Confondre profondeur et pile pleine.** Un DFS récursif sur un graphe profond déborde la
  pile d'appels ; la version itérative avec pile explicite, non.
