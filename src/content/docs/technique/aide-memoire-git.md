---
title: Aide-mémoire Git
description: Les commandes Git qu'on oublie toujours, et surtout celles qui réparent.
tags: [git, outils]
statut: stable
---

Les commandes du quotidien s'apprennent vite. Celles qui suivent sont celles qu'on cherche
en urgence, une fois par trimestre.

## Réparer

```bash
# Annuler le dernier commit, garder les modifications dans l'index
git reset --soft HEAD~1

# Annuler le dernier commit et les modifications (destructif)
git reset --hard HEAD~1

# Corriger le message du dernier commit
git commit --amend

# Ajouter un fichier oublié au dernier commit, sans changer le message
git add fichier-oublie.ts && git commit --amend --no-edit

# Annuler un commit déjà poussé, en créant un commit inverse
git revert <sha>

# Récupérer un fichier tel qu'il était sur main
git restore --source=main -- chemin/fichier.ts
```

:::caution
`reset --hard` et `push --force` détruisent du travail. Sur une branche partagée, préfère
`git revert` et `git push --force-with-lease`, qui refuse d'écraser des commits que tu n'as
pas encore vus.
:::

## Retrouver ce qu'on croit perdu

`git reflog` est la commande qui sauve. Git garde une trace de chaque position de `HEAD`
pendant environ 90 jours, y compris après un `reset --hard`.

```bash
git reflog                      # l'historique de tous les déplacements de HEAD
git reset --hard HEAD@{3}       # revenir à l'état d'il y a 3 déplacements
git checkout -b sauvetage <sha> # recréer une branche depuis un commit orphelin
```

## Mettre de côté

```bash
git stash push -m "wip refonte du header"
git stash list
git stash pop            # applique et supprime de la pile
git stash apply stash@{2}  # applique sans supprimer
git stash push -- chemin/fichier.ts   # ne remiser qu'un fichier
```

## Fouiller l'historique

```bash
# Qui a touché cette ligne, et dans quel commit
git blame -L 40,60 src/app.ts

# Chercher une chaîne dans tout l'historique (« quand cette fonction a-t-elle disparu ? »)
git log -S "getUserById" --oneline

# Tous les commits touchant un fichier, y compris après renommage
git log --follow -p -- src/lib/url.ts

# Trouver le commit qui a introduit un bug, par dichotomie
git bisect start
git bisect bad                  # la version actuelle est cassée
git bisect good v1.2.0          # celle-ci marchait
# ... git propose des commits, répondre `git bisect good` ou `git bisect bad`
git bisect reset
```

## Branches

```bash
git switch -c ma-branche          # créer et basculer
git switch -                      # revenir à la branche précédente
git branch -m ancien-nom nouveau  # renommer
git branch --merged main          # branches déjà fusionnées, donc supprimables
git fetch --prune                 # nettoyer les branches distantes disparues
```

## Rebase interactif

Nettoyer une branche avant d'ouvrir une pull request :

```bash
git rebase -i main
```

Dans l'éditeur, remplacer `pick` par :

| Mot-clé | Effet |
| --- | --- |
| `reword` | garder le commit, changer son message |
| `squash` | fusionner avec le commit précédent, fusionner les messages |
| `fixup` | fusionner avec le précédent, jeter le message |
| `drop` | supprimer le commit |

En cas de conflit : corriger, `git add`, puis `git rebase --continue`. Pour tout annuler,
`git rebase --abort`.

:::danger
Ne jamais rebaser une branche déjà poussée sur laquelle quelqu'un d'autre travaille.
En solo, c'est sans risque.
:::

## Configuration utile

```bash
git config --global pull.rebase true          # pull en rebase, pas en merge
git config --global push.autoSetupRemote true # plus besoin de --set-upstream
git config --global rerere.enabled true       # mémorise la résolution des conflits répétés
git config --global init.defaultBranch main
```

## Pièges classiques

- **Le fichier ignoré qui reste suivi.** Ajouter une ligne au `.gitignore` ne désuit pas un
  fichier déjà commité. Il faut `git rm --cached chemin/fichier`.
- **`git checkout` fait deux choses.** Changer de branche *et* restaurer des fichiers. Les
  commandes modernes `git switch` et `git restore` séparent les deux : moins d'accidents.
- **Un secret commité reste dans l'historique.** Le retirer dans un commit suivant ne suffit
  pas : il est toujours lisible. Le seul vrai réflexe est de **révoquer le secret**.
