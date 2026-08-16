---
title: Graphes
description: Représentations, parcours en largeur et en profondeur, plus court chemin.
tags: [graphe, parcours, algorithme, structure-de-donnees]
statut: stable
sidebar:
  order: 6
---

## En une phrase

Un graphe est un ensemble de **sommets** reliés par des **arêtes** — la structure de tout ce
qui est « relation » : réseaux, dépendances, itinéraires, réseaux sociaux.

## Vocabulaire

- **Orienté / non orienté** — l'arête a-t-elle un sens ? « suit sur Twitter » est orienté,
  « est ami avec sur Facebook » ne l'est pas.
- **Pondéré** — chaque arête porte un coût (distance, temps, prix).
- **Cycle** — un chemin qui revient à son point de départ. Un graphe orienté sans cycle est un
  **DAG**, structure des systèmes de build et des dépendances de paquets.
- **Connexe** — tous les sommets sont atteignables depuis n'importe quel autre.

## Deux représentations

**Liste d'adjacence** — pour chaque sommet, la liste de ses voisins. C'est le défaut.

```python
graphe = {
    'A': ['B', 'C'],
    'B': ['D'],
    'C': ['D'],
    'D': [],
}
```

**Matrice d'adjacence** — un tableau `n × n` où `M[i][j]` vaut 1 s'il y a une arête.

|  | A | B | C | D |
| --- | --- | --- | --- | --- |
| **A** | 0 | 1 | 1 | 0 |
| **B** | 0 | 0 | 0 | 1 |
| **C** | 0 | 0 | 0 | 1 |
| **D** | 0 | 0 | 0 | 0 |

| Critère | Liste d'adjacence | Matrice |
| --- | --- | --- |
| Espace | O(S + A) | O(S²) |
| Tester une arête | O(degré) | **O(1)** |
| Parcourir les voisins | **O(degré)** | O(S) |
| Adaptée à | graphes creux | graphes denses |

En pratique, la plupart des graphes réels sont **creux** (peu d'arêtes par rapport au nombre
possible) : la liste d'adjacence gagne presque toujours.

## Parcours en largeur (BFS)

Explore niveau par niveau, avec une **file**. Garantit le plus court chemin **en nombre
d'arêtes**.

```python
from collections import deque

def bfs(graphe, depart):
    vus = {depart}
    file = deque([depart])
    while file:
        sommet = file.popleft()
        yield sommet
        for voisin in graphe[sommet]:
            if voisin not in vus:
                vus.add(voisin)       # marquer À L'ENFILEMENT
                file.append(voisin)
```

Complexité : **O(S + A)**.

Pour reconstruire le chemin, mémoriser le prédécesseur de chaque sommet :

```python
def plus_court_chemin(graphe, depart, arrivee):
    predecesseur = {depart: None}
    file = deque([depart])
    while file:
        sommet = file.popleft()
        if sommet == arrivee:
            chemin = []
            while sommet is not None:
                chemin.append(sommet)
                sommet = predecesseur[sommet]
            return chemin[::-1]
        for voisin in graphe[sommet]:
            if voisin not in predecesseur:
                predecesseur[voisin] = sommet
                file.append(voisin)
    return None
```

## Parcours en profondeur (DFS)

Descend au fond d'une branche avant de reculer. Avec une **pile**, ou par récursion.

```python
def dfs(graphe, sommet, vus=None):
    if vus is None:
        vus = set()
    vus.add(sommet)
    yield sommet
    for voisin in graphe[sommet]:
        if voisin not in vus:
            yield from dfs(graphe, voisin, vus)
```

Complexité : **O(S + A)**.

Sert à : détecter des cycles, trier topologiquement, trouver les composantes connexes,
explorer tous les chemins possibles.

## Tri topologique

Ordonner un DAG de sorte que chaque sommet vienne avant ses successeurs. C'est ce que fait
un gestionnaire de paquets pour décider de l'ordre d'installation.

```python
def tri_topologique(graphe):
    vus, ordre = set(), []

    def visiter(sommet):
        if sommet in vus:
            return
        vus.add(sommet)
        for voisin in graphe[sommet]:
            visiter(voisin)
        ordre.append(sommet)       # empilé APRÈS ses dépendances

    for sommet in graphe:
        visiter(sommet)
    return ordre[::-1]
```

S'il existe un cycle, il n'y a pas d'ordre valide — c'est exactement le message
« dépendance circulaire » des outils de build.

## Dijkstra — plus court chemin pondéré

Quand les arêtes ont un coût, le BFS ne suffit plus. Dijkstra visite toujours le sommet
non traité le plus proche, à l'aide d'une file de priorité.

```python
import heapq

def dijkstra(graphe, depart):
    """graphe : {sommet: [(voisin, poids), ...]}"""
    distances = {depart: 0}
    file = [(0, depart)]
    while file:
        distance, sommet = heapq.heappop(file)
        if distance > distances.get(sommet, float('inf')):
            continue                      # entrée périmée
        for voisin, poids in graphe[sommet]:
            nouvelle = distance + poids
            if nouvelle < distances.get(voisin, float('inf')):
                distances[voisin] = nouvelle
                heapq.heappush(file, (nouvelle, voisin))
    return distances
```

Complexité : **O((S + A) log S)** avec un tas binaire.

:::caution
Dijkstra **ne fonctionne pas avec des poids négatifs** : il suppose qu'un chemin ne peut pas
devenir plus court en s'allongeant. Dans ce cas, utiliser Bellman-Ford, en O(S × A).
:::

## Choisir son algorithme

| Question | Algorithme |
| --- | --- |
| Y a-t-il un chemin entre A et B ? | BFS ou DFS |
| Plus court chemin, arêtes non pondérées | BFS |
| Plus court chemin, poids positifs | Dijkstra |
| Plus court chemin, poids négatifs | Bellman-Ford |
| Ordre de traitement d'un DAG | Tri topologique |
| Y a-t-il un cycle ? | DFS avec marquage à trois états |
| Relier tous les sommets au moindre coût | Kruskal ou Prim |

## Pièges classiques

- **Oublier l'ensemble des sommets vus.** Sur un graphe cyclique, le parcours boucle
  indéfiniment. C'est l'erreur numéro un.
- **Marquer au défilement en BFS.** Il faut marquer à l'enfilement, sinon un sommet peut être
  enfilé plusieurs fois avant d'être traité — le parcours reste correct mais devient beaucoup
  plus lent.
- **Détecter un cycle en orienté avec un simple ensemble `vus`.** Il faut distinguer
  « en cours de visite » de « visite terminée » : revoir un sommet déjà terminé n'est pas un
  cycle, revoir un sommet en cours en est un.
- **Utiliser une matrice d'adjacence sur un grand graphe creux.** Un million de sommets, c'est
  10¹² cases : impossible à allouer.
