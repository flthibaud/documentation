---
title: Tableaux et listes chaînées
description: Accès direct contre insertion bon marché — le premier arbitrage de toute structure.
tags: [tableau, liste-chainee, structure-de-donnees]
statut: stable
sidebar:
  order: 2
---

## En une phrase

Le tableau stocke ses éléments **côte à côte en mémoire** (accès instantané, insertion chère),
la liste chaînée les relie **par des pointeurs** (insertion instantanée, accès cher).

## Représentation en mémoire

```
Tableau      [ 10 | 20 | 30 | 40 ]     ← contigu, adresse = début + i × taille
              0    1    2    3

Liste        [10|•]→[20|•]→[30|•]→[40|∅]   ← dispersé, chaque nœud pointe vers le suivant
```

C'est toute la différence. Le tableau calcule l'adresse de `tab[i]` par une multiplication.
La liste doit suivre `i` pointeurs.

## Complexités

| Opération | Tableau | Liste chaînée |
| --- | --- | --- |
| Accès par indice | **O(1)** | O(n) |
| Recherche | O(n) | O(n) |
| Insertion en tête | O(n) | **O(1)** |
| Insertion en queue | O(1) amorti | O(1) si on garde la queue |
| Insertion au milieu | O(n) | O(1) *si on a déjà le nœud* |
| Suppression au milieu | O(n) | O(1) *si on a déjà le nœud* |

:::caution
Le O(1) d'insertion de la liste chaînée suppose qu'on **tient déjà le nœud précédent**. Si on
part du début, il faut d'abord le trouver : O(n). En pratique, insérer « au milieu » d'une
liste coûte donc O(n) comme dans un tableau — sans le bénéfice de la contiguïté.
:::

## Tableau dynamique

C'est ce que sont réellement `list` en Python, `ArrayList` en Java, `Vec` en Rust,
`std::vector` en C++ : un tableau qui **double sa capacité** quand il est plein.

```
capacité 4, taille 4  →  append  →  alloue 8, recopie les 4, insère
```

La recopie coûte O(n), mais elle est de plus en plus rare : l'ajout est **O(1) amorti**.
Le doublement gaspille jusqu'à 50 % de mémoire — c'est le prix.

## Implémentation d'une liste simplement chaînée

```python
class Noeud:
    def __init__(self, valeur, suivant=None):
        self.valeur = valeur
        self.suivant = suivant

class ListeChainee:
    def __init__(self):
        self.tete = None

    def inserer_en_tete(self, valeur):   # O(1)
        self.tete = Noeud(valeur, self.tete)

    def supprimer(self, valeur):          # O(n)
        precedent, courant = None, self.tete
        while courant:
            if courant.valeur == valeur:
                if precedent:
                    precedent.suivant = courant.suivant
                else:
                    self.tete = courant.suivant
                return True
            precedent, courant = courant, courant.suivant
        return False

    def __iter__(self):
        courant = self.tete
        while courant:
            yield courant.valeur
            courant = courant.suivant
```

## Variantes de listes

- **Doublement chaînée** — chaque nœud pointe aussi vers le précédent. Permet de supprimer un
  nœud en O(1) sans connaître son prédécesseur. C'est la base des caches LRU.
- **Circulaire** — le dernier nœud pointe vers le premier. Utile pour un ordonnancement en
  tourniquet.
- **Avec sentinelle** — un nœud fictif en tête supprime tous les cas particuliers du code
  d'insertion et de suppression. Vaut largement le nœud gaspillé.

## Quand utiliser un tableau

Presque toujours. C'est le défaut raisonnable :

- Accès par indice, parcours, tri.
- Taille connue ou raisonnablement stable.
- Beaucoup de lectures, peu d'insertions en début de séquence.

## Quand utiliser une liste chaînée

- Insertions et suppressions fréquentes **à des positions déjà connues** (on tient le nœud).
- Structure de base d'une file, d'un cache LRU, ou de la gestion des collisions d'une table
  de hachage.
- Quand on ne peut pas se permettre le coût d'une réallocation, ou qu'il n'y a pas de bloc
  contigu disponible.

## Pièges classiques

- **La liste chaînée est bien plus lente qu'annoncé.** Chaque nœud est ailleurs en mémoire :
  chaque saut est un défaut de cache. Sur du parcours pur, un tableau la bat souvent d'un
  facteur 10, même là où la théorie les dit équivalents.
- **Le surcoût mémoire.** Un nœud, c'est la valeur *plus* un pointeur (8 octets sur 64 bits).
  Pour une liste d'entiers, c'est plus de mémoire pour les pointeurs que pour les données.
- **Supprimer en itérant.** Modifier un tableau pendant qu'on le parcourt saute des éléments.
  Itérer sur une copie, ou construire une nouvelle liste par compréhension.
- **`insert(0, x)` en Python est en O(n).** Pour une file, utiliser `collections.deque`,
  dont l'insertion en tête est en O(1).
