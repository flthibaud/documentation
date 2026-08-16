---
title: Complexité algorithmique
description: Lire un O(n), comparer deux algorithmes, et savoir quand la complexité compte vraiment.
tags: [complexite, algorithme, structure-de-donnees]
statut: stable
sidebar:
  order: 1
sources:
  - titre: Big-O Cheat Sheet
    url: https://www.bigocheatsheet.com/
---

## En une phrase

La complexité mesure **comment le coût d'un algorithme grandit quand la taille de l'entrée
grandit** — pas son temps d'exécution absolu.

## Les ordres de grandeur

| Notation | Nom | Exemple | n = 1 000 000 |
| --- | --- | --- | --- |
| O(1) | constante | accès à `tab[i]` | 1 |
| O(log n) | logarithmique | recherche dichotomique | ~20 |
| O(n) | linéaire | parcourir un tableau | 10⁶ |
| O(n log n) | linéarithmique | tri fusion, tri rapide | ~2 × 10⁷ |
| O(n²) | quadratique | double boucle imbriquée | 10¹² |
| O(2ⁿ) | exponentielle | sous-ensembles d'un ensemble | inatteignable |

La marche est brutale entre `O(n log n)` et `O(n²)`. Sur un million d'éléments, le premier
prend une seconde, le second des jours.

## Lire une complexité

On garde **le terme dominant, sans les constantes** :

- `3n + 100` → O(n)
- `n² + 1000n` → O(n²), parce que `n²` finit toujours par écraser `1000n`
- `log(n) + n` → O(n)

Deux boucles **imbriquées** sur `n` donnent O(n²). Deux boucles **successives** donnent O(n) :

```python
for i in range(n):        # O(n)
    for j in range(n):    # × O(n)
        travail()         # = O(n²)

for i in range(n):        # O(n)
    travail()
for j in range(n):        # + O(n)
    travail()             # = O(n)
```

## Les trois cas

- **Meilleur cas** (Ω) — rarement utile.
- **Cas moyen** (Θ) — le plus réaliste, c'est celui qu'on cite en pratique.
- **Pire cas** (O) — celui qu'on garantit. C'est la notation par défaut.

L'écart compte : la recherche dans une table de hachage est en O(1) *en moyenne* mais en O(n)
*au pire*, quand toutes les clés entrent en collision.

## Complexité amortie

Un tableau dynamique double sa capacité quand il est plein. Ce redimensionnement coûte O(n)…
mais il n'arrive qu'une fois toutes les `n` insertions. Réparti sur toutes les opérations,
l'ajout coûte **O(1) amorti**.

C'est ce qui permet de dire qu'un `append` Python est en O(1) alors qu'il est parfois en O(n).

## Complexité spatiale

Même raisonnement, appliqué à la mémoire. Attention à la **pile d'appels** : une récursion de
profondeur `n` occupe O(n) d'espace même si elle n'alloue rien explicitement.

```python
def somme(liste):          # O(n) en espace : n appels empilés
    if not liste:
        return 0
    return liste[0] + somme(liste[1:])
```

## Quand ça ne compte pas

- **Sur de petites entrées.** Un tri à bulles sur 20 éléments est plus rapide qu'un tri fusion :
  moins de surcoût. C'est pourquoi les vraies implémentations basculent sur un tri par insertion
  en dessous d'un seuil.
- **Quand le goulot est ailleurs.** Un appel réseau coûte des millions de cycles. Optimiser une
  boucle O(n²) sur 50 éléments à côté ne change rien.
- **Quand la constante domine.** O(n) avec une constante de 1000 perd contre O(n²) avec une
  constante de 1, jusqu'à n = 1000.

## Pièges classiques

- **`in` sur une liste est en O(n)**, sur un ensemble ou un dictionnaire en O(1). Une boucle
  contenant `if x in ma_liste` est un O(n²) déguisé — c'est le bug de performance le plus
  fréquent en Python.
- **La concaténation de chaînes dans une boucle** est en O(n²) dans la plupart des langages,
  les chaînes étant immuables. Utiliser `"".join(...)` ou un `StringBuilder`.
- **Le slicing copie.** `liste[1:]` en Python est en O(n), pas en O(1) : une récursion qui
  découpe ainsi est bien plus coûteuse qu'elle n'en a l'air.
