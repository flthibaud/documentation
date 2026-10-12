---
title: Déclencheurs et conditions
description: Quand un workflow part, quand un job est sauté, et comment deux runs simultanés cohabitent.
tags: [ci, github, workflow]
statut: stable
sidebar:
  order: 2
sources:
  - titre: GitHub — Events that trigger workflows
    url: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
  - titre: GitHub — Control the concurrency of workflows and jobs
    url: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/control-the-concurrency-of-workflows-and-jobs
---

## Les déclencheurs qui servent

```yaml
on:
  push:
    branches: [master, develop]
    tags: ["v*"]
  pull_request:
    branches: [master, develop]
  workflow_dispatch:          # bouton « Run workflow » dans l'onglet Actions
```

| Événement | Part quand | Utilisé pour |
| --- | --- | --- |
| `push` | un commit ou un tag arrive sur le dépôt | intégration, publication d'image, release |
| `pull_request` | ouverture, mise à jour, réouverture d'une PR | les vérifications avant merge |
| `workflow_dispatch` | déclenchement manuel | rejouer un déploiement, tâche d'admin |
| `schedule` | cron UTC | audits, nettoyages |
| `workflow_call` | appel depuis un autre workflow | factoriser un workflow réutilisable |

Sur `push`, `branches` et `tags` sont **indépendants** : le workflow de Signet part sur un
push vers `master` ou `develop`, *et* sur tout tag `v*`, quelle que soit la branche portant
le commit tagué.

Le filtre `branches` d'un `pull_request` porte sur la **branche cible**, pas la branche de
travail. `branches: [develop]` signifie « toute PR qui veut entrer dans `develop` ».

## Le double déclenchement

Une branche poussée sur le dépôt et couverte par les deux filtres déclenche deux runs : un
`push` et un `pull_request`. Deux fois les minutes, deux fois les statuts.

Le montage de Signet l'évite sans y penser : `push` ne liste que `master` et `develop`,
c'est-à-dire les branches sur lesquelles personne ne travaille directement. Une branche
`feat/*` ne déclenche que le `pull_request`.

L'autre montage courant est `on: [pull_request]` seul, avec un `push` limité à la branche
par défaut. Le point à retenir : la duplication vient d'un chevauchement des filtres, pas
d'une bizarrerie de GitHub.

## Filtrer par chemin

```yaml
on:
  pull_request:
    paths:
      - 'frontend/**'
      - '.github/workflows/ci.yml'
```

:::caution
Un job filtré par `paths` et déclaré **required** dans les règles de branche bloque
définitivement les PR qui ne touchent pas ces chemins : le statut requis n'arrive jamais,
la PR reste en attente. La parade est un job « fantôme » qui répond toujours vert, ou de
mettre la condition dans un `if:` plutôt que dans `paths`.
:::

## `if:` — sauter un job ou une étape

Un `if` faux ne fait pas échouer, il **saute** (grisé dans l'interface). Les `${{ }}` sont
optionnels dans un `if` : GitHub évalue l'expression de toute façon.

Les trois formes présentes dans Signet :

```yaml
# Le job de push d'image ne tourne pas sur une PR : le jeton d'une PR de fork est en
# lecture seule, et une image issue d'un code non fusionné n'a rien à faire au registre.
if: github.event_name != 'pull_request'

# Le job de release ne tourne que sur un tag.
if: startsWith(github.ref, 'refs/tags/v')

# Ne rien tenter si Chrome n'a pas pu s'installer (Wacan).
if: steps.chrome.outcome == 'success'
```

### `outcome` contre `conclusion`

Une étape en `continue-on-error: true` qui échoue laisse le job vert, mais garde la trace de
son échec :

| Champ | Valeur |
| --- | --- |
| `steps.<id>.outcome` | le résultat **réel** : `success`, `failure`, `cancelled`, `skipped` |
| `steps.<id>.conclusion` | le résultat **après** application de `continue-on-error` |

C'est `outcome` qu'on teste pour dire « l'installation a raté, saute la suite », comme dans
l'étape Lighthouse de Wacan. `conclusion` y vaudrait `success` et la condition serait
toujours vraie.

### Les fonctions d'état

| Fonction | Sens |
| --- | --- |
| `success()` | implicite : c'est le défaut de tout `if` absent |
| `always()` | même après un échec **et** après une annulation |
| `failure()` | seulement si quelque chose a échoué avant |
| `cancelled()` | seulement sur annulation |

`if: always()` sur un envoi d'artefact garantit que le rapport d'un run raté est quand même
récupérable — c'est justement quand ça casse qu'on en a besoin.

:::caution
`always()` s'exécute aussi quand tu cliques sur « Cancel ». Pour un nettoyage, c'est
voulu ; pour une notification, `if: !cancelled()` est plus juste.
:::

## Concurrence

Sans `concurrency`, deux pushes rapprochés produisent deux runs qui tournent en parallèle,
et rien ne garantit l'ordre d'arrivée à la fin.

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

Le `group` est une chaîne libre : deux runs qui calculent le même groupe s'excluent. Ici,
un groupe par workflow **et** par référence, donc `develop` et une PR ne se gênent pas.

`cancel-in-progress` est le seul vrai choix, et il se décide par ce que fait le run :

| Cas | Valeur | Pourquoi |
| --- | --- | --- |
| Vérifications d'une PR | `true` | le commit d'avant n'intéresse plus personne |
| Push qui publie une image ou déploie | `false` | annuler au milieu d'un push laisse un registre à moitié écrit |

D'où l'expression conditionnelle de Signet — annulation sur les PR, jamais sur les branches
publiantes — là où Wacan, qui ne se déclenche que sur des branches déployées, fixe
simplement `false`. Le workflow Pages de ce site va plus loin avec `group: pages`, une
constante : tous les déploiements du dépôt, quelle que soit la branche, passent un par un.

## Pièges

- **`schedule` et `workflow_dispatch` lisent le workflow de la branche par défaut.** Une
  modification testée sur une autre branche ne changera rien tant qu'elle n'est pas
  fusionnée. Pour `push` et `pull_request`, c'est la version du fichier au niveau du commit
  concerné qui s'applique.
- **Un `cron` GitHub n'est pas ponctuel.** Il part quand la file se vide, avec un retard qui
  se compte parfois en dizaines de minutes, et il est désactivé après 60 jours sans activité
  sur un dépôt public.
- **Un tag poussé seul ne déclenche rien s'il n'est pas dans `tags:`.** Le filtre `branches`
  ne couvre pas les tags, et inversement.
- **`git push` n'envoie pas les tags.** Le workflow ne part pas parce que le tag est resté
  local : `git push --follow-tags`.
- **Un push de plus de 100 commits d'un coup** ne déclenche qu'un run, et `github.event.commits`
  y est tronqué.
