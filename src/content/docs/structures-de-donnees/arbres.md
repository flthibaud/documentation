---
title: Arbres
description: ABR, équilibrage, tas binaires, et le lien direct avec les index de bases de données.
tags: [arbre, abr, tas, structure-de-donnees, index-bdd]
statut: stable
sidebar:
  order: 5
---

## En une phrase

Un arbre organise les données en **hiérarchie**, ce qui permet d'éliminer la moitié des
candidats à chaque étape — d'où le O(log n).

## Vocabulaire

```
            (8)          ← racine, profondeur 0
           /   \
        (3)     (10)     ← profondeur 1
        / \        \
     (1) (6)       (14)  ← feuilles (sauf 6 qui a des enfants)
```

- **Racine** : le nœud du sommet. **Feuille** : un nœud sans enfant.
- **Hauteur** : la plus longue distance racine → feuille. C'est elle qui fixe la complexité.
- Un arbre de `n` nœuds a une hauteur d'au moins `log₂(n)` et d'au plus `n - 1`.

## Arbre binaire de recherche (ABR)

L'invariant, à respecter en tout nœud : **tout ce qui est à gauche est plus petit, tout ce qui
est à droite est plus grand.**

```python
class Noeud:
    def __init__(self, valeur):
        self.valeur = valeur
        self.gauche = None
        self.droite = None

def inserer(racine, valeur):
    if racine is None:
        return Noeud(valeur)
    if valeur < racine.valeur:
        racine.gauche = inserer(racine.gauche, valeur)
    elif valeur > racine.valeur:
        racine.droite = inserer(racine.droite, valeur)
    return racine

def rechercher(racine, valeur):
    if racine is None or racine.valeur == valeur:
        return racine
    if valeur < racine.valeur:
        return rechercher(racine.gauche, valeur)
    return rechercher(racine.droite, valeur)
```

| Opération | Équilibré | Dégénéré |
| --- | --- | --- |
| Recherche | O(log n) | O(n) |
| Insertion | O(log n) | O(n) |
| Suppression | O(log n) | O(n) |

:::danger
Insérer des données **déjà triées** dans un ABR naïf produit une liste chaînée : la hauteur
devient `n` et toutes les opérations tombent en O(n). C'est le piège fondamental de l'ABR,
et toute la raison d'être de l'équilibrage.
:::

## Parcours

```python
def infixe(noeud):      # gauche, nœud, droite  → ordre CROISSANT sur un ABR
    if noeud:
        yield from infixe(noeud.gauche)
        yield noeud.valeur
        yield from infixe(noeud.droite)

def prefixe(noeud):     # nœud, gauche, droite  → copier/sérialiser un arbre
    if noeud:
        yield noeud.valeur
        yield from prefixe(noeud.gauche)
        yield from prefixe(noeud.droite)

def suffixe(noeud):     # gauche, droite, nœud  → libérer/évaluer une expression
    if noeud:
        yield from suffixe(noeud.gauche)
        yield from suffixe(noeud.droite)
        yield noeud.valeur
```

Le parcours **infixe d'un ABR donne les valeurs triées** — c'est le moyen le plus simple de
vérifier qu'un arbre est un ABR valide.

Le parcours **en largeur** (niveau par niveau) utilise une file, pas la récursion — voir
[Piles et files](/documentation/structures-de-donnees/piles-et-files/).

## Arbres équilibrés

Ils garantissent une hauteur en O(log n) en se réorganisant à l'insertion, par des
**rotations** :

- **AVL** — équilibrage strict (l'écart de hauteur entre deux sous-arbres ne dépasse jamais 1).
  Recherches très rapides, insertions plus coûteuses.
- **Rouge-noir** — équilibrage plus souple, moins de rotations. C'est le compromis retenu par
  `TreeMap` en Java et `std::map` en C++.
- **B-arbre / B+arbre** — nœuds à plusieurs centaines d'enfants, conçus pour le disque.

## Le lien avec les bases de données

Un index SQL est un **B+arbre**. Chaque nœud correspond à une page disque, et un nœud contient
des centaines de clés : la hauteur reste de 3 ou 4 niveaux même pour des millions de lignes.
Trouver une ligne coûte donc 3 ou 4 lectures disque au lieu d'un balayage complet.

C'est aussi ce qui explique deux comportements courants :

- Un index accélère `WHERE`, `ORDER BY` et les requêtes par intervalle, parce que les feuilles
  du B+arbre sont chaînées **dans l'ordre**.
- Un index ralentit `INSERT`, `UPDATE` et `DELETE` : l'arbre doit être maintenu équilibré à
  chaque écriture.

## Tas binaire

Arbre binaire **complet** avec un invariant différent : tout parent est plus petit que ses
enfants (tas-min). La racine est donc toujours le minimum.

| Opération | Complexité |
| --- | --- |
| Lire le minimum | O(1) |
| Insérer | O(log n) |
| Extraire le minimum | O(log n) |
| Construire depuis n éléments | O(n) |

Un tas se stocke dans un **simple tableau**, sans aucun pointeur : pour l'indice `i`, les
enfants sont en `2i+1` et `2i+2`, le parent en `(i-1)//2`.

```python
import heapq

tas = [5, 3, 8, 1]
heapq.heapify(tas)          # O(n)
heapq.heappush(tas, 2)      # O(log n)
minimum = heapq.heappop(tas)  # 1, en O(log n)

heapq.nsmallest(3, donnees)   # les 3 plus petits sans tout trier
```

C'est l'implémentation des files de priorité, le cœur de Dijkstra, et la base du tri par tas.

## Autres arbres utiles

- **Trie (arbre préfixe)** — une lettre par arête. Autocomplétion, correcteurs orthographiques.
  Recherche en O(longueur du mot), indépendante du nombre de mots stockés.
- **Arbre de segments** — requêtes sur des intervalles (somme, minimum sur `[i, j]`) en O(log n).
- **Quadtree / octree** — partitionnement de l'espace, en jeu vidéo et en géospatial.

## Quand utiliser un arbre

- Il faut à la fois de la recherche rapide **et** de l'ordre.
- Requêtes par intervalle, minimum ou maximum, successeur d'une valeur.
- Données naturellement hiérarchiques : système de fichiers, DOM, arbre syntaxique.

## Quand l'éviter

Si l'ordre n'a aucune importance, une table de hachage est plus simple et plus rapide.
L'arbre paie du O(log n) pour un ordre dont on ne se sert pas.

## Pièges classiques

- **Oublier l'équilibrage.** Un ABR maison sur des données triées est en O(n). En production,
  utiliser la structure équilibrée fournie par la bibliothèque standard.
- **La suppression dans un ABR.** Le cas du nœud à deux enfants demande de le remplacer par son
  successeur infixe (le plus petit du sous-arbre droit). C'est là que les implémentations
  maison se trompent.
- **Récursion profonde.** Un arbre déséquilibré de 10 000 nœuds fait déborder la pile d'appels
  en Python (limite par défaut : 1 000).
- **Confondre tas et ABR.** Un tas ne permet **pas** de rechercher efficacement une valeur
  quelconque : c'est O(n). Il ne garantit que l'accès au minimum.
