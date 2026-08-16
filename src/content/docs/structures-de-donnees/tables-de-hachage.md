---
title: Tables de hachage
description: O(1) en moyenne — la structure la plus utilisée du métier, et ses conditions de validité.
tags: [table-de-hachage, dictionnaire, structure-de-donnees]
statut: stable
sidebar:
  order: 4
---

## En une phrase

Une fonction de hachage transforme une clé en indice de tableau, ce qui permet de retrouver
une valeur **sans parcourir quoi que ce soit**.

## Le principe

```
clé "marie"  →  hash()  →  4382917  →  % 8  →  case 5
                                                 ↓
                        [0][1][2][3][4][5][6][7]
                                       ("marie", 27)
```

Trois étapes : hacher la clé, réduire modulo la taille du tableau, ranger à cet indice.

## Complexités

| Opération | Moyenne | Pire cas |
| --- | --- | --- |
| Insertion | **O(1)** | O(n) |
| Recherche | **O(1)** | O(n) |
| Suppression | **O(1)** | O(n) |

Espace : O(n), avec un gaspillage volontaire — voir le facteur de charge.

Le pire cas O(n) survient quand toutes les clés atterrissent dans la même case.

## Les collisions

Deux clés différentes peuvent donner le même indice. C'est inévitable : il y a bien plus de
clés possibles que de cases. Deux stratégies :

**Chaînage** — chaque case contient une liste des paires qui s'y trouvent. Simple, robuste.
C'est ce qu'utilise `HashMap` en Java.

```
[0] → ∅
[1] → ("paul", 31) → ("lucie", 22)     ← collision
[2] → ∅
```

**Adressage ouvert** — en cas de collision, on cherche la case libre suivante. Plus compact,
meilleure localité mémoire, mais la suppression devient délicate (il faut un marqueur
« case libérée » pour ne pas casser les chaînes de sondage). C'est ce qu'utilise Python.

## Facteur de charge et redimensionnement

Le **facteur de charge** est le rapport `nombre d'éléments / nombre de cases`. Au-delà d'un
seuil (0,75 en Java, ~0,66 en Python), les collisions deviennent fréquentes et la structure
double sa taille en **réinsérant toutes les clés** — un O(n) ponctuel, amorti en O(1).

C'est pourquoi une table de hachage occupe toujours plus de mémoire que ses données.

## Implémentation minimale (chaînage)

```python
class TableHachage:
    def __init__(self, capacite=8):
        self.cases = [[] for _ in range(capacite)]
        self.taille = 0

    def _indice(self, cle):
        return hash(cle) % len(self.cases)

    def inserer(self, cle, valeur):
        case = self.cases[self._indice(cle)]
        for i, (k, _) in enumerate(case):
            if k == cle:
                case[i] = (cle, valeur)   # mise à jour
                return
        case.append((cle, valeur))
        self.taille += 1
        if self.taille / len(self.cases) > 0.75:
            self._agrandir()

    def obtenir(self, cle):
        for k, v in self.cases[self._indice(cle)]:
            if k == cle:
                return v
        raise KeyError(cle)

    def _agrandir(self):
        anciennes = self.cases
        self.cases = [[] for _ in range(len(anciennes) * 2)]
        self.taille = 0
        for case in anciennes:
            for cle, valeur in case:
                self.inserer(cle, valeur)
```

## Ce qu'une bonne fonction de hachage doit faire

- **Répartir uniformément** : toutes les cases également sollicitées.
- **Être rapide** : elle est appelée à chaque opération.
- **Être déterministe** : la même clé donne toujours le même résultat, pour toute la durée
  de vie du programme.

:::caution
`hash()` en Python est **randomisé entre deux exécutions** pour les chaînes (protection contre
les attaques par collision). Ne jamais persister un `hash()` Python sur disque ou en base :
utiliser `hashlib` pour ça.
:::

## Clés valides

Une clé doit être **immuable**, ou du moins ne pas changer tant qu'elle est dans la table.
Si elle change, son hash change, et l'élément devient introuvable — il est toujours là, dans
l'ancienne case.

```python
cle = [1, 2]
d = {cle: "valeur"}   # TypeError: unhashable type: 'list'
d = {(1, 2): "valeur"}  # un tuple est immuable, donc hachable
```

En Java, redéfinir `equals()` sans redéfinir `hashCode()` produit exactement ce bug :
deux objets égaux tombent dans des cases différentes.

## Quand l'utiliser

- Recherche par clé, test d'appartenance, déduplication, comptage, mise en cache, index.
- C'est le défaut dès qu'on pense « associer une valeur à une clé ».

## Quand l'éviter

- **Quand l'ordre compte.** Une table de hachage n'a pas d'ordre naturel. Pour du trié ou des
  requêtes par intervalle (« toutes les clés entre 10 et 20 »), il faut un arbre.
- **Quand la mémoire est comptée.** Le gaspillage lié au facteur de charge est structurel.
- **Sur de très petites collections.** En dessous d'une dizaine d'éléments, un parcours
  linéaire de tableau est plus rapide : pas de hachage à calculer.

## Pièges classiques

- **Compter sur l'ordre d'insertion.** Depuis Python 3.7, `dict` le préserve — c'est une
  garantie du langage, mais pas une propriété des tables de hachage. Ne pas transposer à
  d'autres langages.
- **Itérer en modifiant.** Ajouter ou supprimer pendant l'itération peut déclencher un
  redimensionnement et invalider le parcours. Itérer sur `list(d.keys())`.
- **Utiliser un flottant comme clé.** `0.1 + 0.2 != 0.3` : les erreurs d'arrondi rendent les
  clés introuvables.
- **Oublier que le pire cas existe.** Une entrée utilisateur choisie pour provoquer des
  collisions peut dégrader une table en O(n) — c'est une véritable classe d'attaque par déni
  de service.
