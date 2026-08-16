---
title: Comment utiliser cette base
description: Organisation des rayons, cycle de vie d'une fiche, navigation.
sidebar:
  order: 1
tags: [meta]
---

## Les rayons

| Rayon | Dossier | Contenu |
| --- | --- | --- |
| Documentation technique | `technique/` | aide-mémoires, procédures, décisions techniques |
| Structures de données | `structures-de-donnees/` | une fiche par structure : opérations, complexités, pièges |
| IUT | `iut/` | cours par matière |
| Meta | `meta/` | conventions et fonctionnement de la base |

## Navigation

- **Recherche** (`Ctrl` + `K`) — Pagefind, indexe le texte et les blocs de code.
- **Sidebar** — autogénérée depuis l'arborescence des dossiers.
- **Tags** — navigation transversale entre rayons : un cours d'IUT et une note technique
  partagent un tag.

## Statut d'une fiche

Le champ `statut` du frontmatter, affiché sous le titre quand il n'est pas `stable` :

| Valeur | Sens |
| --- | --- |
| `brouillon` | jeté vite fait, non relu |
| `en-cours` | fond présent, forme à reprendre |
| `stable` | relu — valeur par défaut |

`draft: true` retire la fiche du build de production tout en la gardant visible en dev.

## Portée

Ce qui a sa place ici : ce qui a coûté du temps à trouver, les concepts à pouvoir réexpliquer
plus tard, les pièges avec leur cause, les décisions techniques et leur contexte.

Ce qui n'en a pas : ce qui est déjà bien documenté et stable ailleurs — un lien suffit.
