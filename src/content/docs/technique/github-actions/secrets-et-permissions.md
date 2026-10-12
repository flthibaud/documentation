---
title: Secrets et permissions
description: GITHUB_TOKEN, droits par job, secrets contre variables, environnements et le cas des forks.
tags: [ci, github, securite, secrets]
statut: stable
sidebar:
  order: 6
sources:
  - titre: GitHub — Automatic token authentication
    url: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-github_token-in-workflows
  - titre: GitHub — Security hardening for GitHub Actions
    url: https://docs.github.com/en/actions/reference/security/secure-use
---

## `GITHUB_TOKEN`

Chaque run reçoit un jeton fabriqué pour lui : `secrets.GITHUB_TOKEN`. Il vaut pour ce dépôt
seulement, expire à la fin du job, et n'a pas besoin d'être créé ni renouvelé. C'est lui qui
pousse sur GHCR et crée les releases dans Signet.

Ses droits sont ceux que le workflow demande, et pas plus :

```yaml
permissions:            # au niveau du workflow : le défaut de tous les jobs
  contents: read

jobs:
  build-and-push:
    permissions:        # au niveau du job : remplace entièrement le bloc du dessus
      contents: read
      packages: write   # pousser une image
  release:
    permissions:
      contents: write   # créer une release, un tag, un commit
```

:::caution
Un bloc `permissions` de job **remplace** celui du workflow, il ne s'y ajoute pas. Déclarer
`packages: write` seul retire au job le `contents: read` — donc le droit de faire un
`checkout` sur un dépôt privé. D'où la répétition de `contents: read` dans le job de Signet.
:::

Les portées qui reviennent :

| Portée | Ce qu'elle ouvre |
| --- | --- |
| `contents: read` | cloner le dépôt |
| `contents: write` | pousser un commit ou un tag, créer une release |
| `packages: write` | pousser une image sur GHCR |
| `pull-requests: write` | commenter une PR, poser un label |
| `id-token: write` | demander un jeton OIDC |
| `pages: write` | déployer sur GitHub Pages |

Le réflexe est `permissions: contents: read` en tête du fichier, puis l'élévation au cas par
cas. Sans bloc du tout, le jeton hérite du réglage du dépôt, qui peut encore être
« read and write » sur un dépôt ancien.

### Ce que le jeton ne peut pas faire

Un push effectué avec `GITHUB_TOKEN` **ne déclenche aucun workflow**. C'est une protection
contre les boucles infinies, et la raison pour laquelle un bot qui bumpe une version et
pousse un tag n'obtient pas de build : il faut alors un PAT ou une GitHub App.

## Secrets, variables, environnements

| | `secrets.X` | `vars.X` |
| --- | --- | --- |
| Contenu | mot de passe, clé, jeton | URL de registre, nom d'image, drapeau |
| Lecture après écriture | impossible | possible |
| Dans les logs | masqué (`***`) | en clair |

Wacan utilise les deux : `vars.REGISTRY_URL` et `vars.IMAGE_NAME` pour la destination,
`secrets.NEXT_PUBLIC_*` pour les valeurs injectées au build. Mettre une URL de registre dans
un secret est un réflexe compréhensible et contre-productif : ça la rend illisible dans les
logs au moment précis où on débogue le push.

Les **environnements** ajoutent une couche par cible de déploiement :

```yaml
environment:
  name: ${{ github.ref == 'refs/heads/master' && 'production' || 'staging' }}
```

Un environnement porte ses propres secrets et variables — un même nom y prend une valeur
différente — et peut exiger une approbation manuelle ou restreindre les branches
autorisées. Un job qui déploie en production sans environnement n'a aucun de ces garde-fous.

:::note
L'expression `A && 'x' || 'y'` est le ternaire de GitHub Actions : il n'y en a pas d'autre.
:::

## Le masquage a des limites

Un secret est remplacé par `***` dans les logs, mais seulement sur une **correspondance
exacte**. Ce qui échappe au masquage :

- une transformation : `echo "$SECRET" | base64`, un extrait, une URL encodée ;
- un secret multi-ligne, dont seules les lignes entières sont reconnues ;
- un secret passé à un outil qui le réaffiche découpé ou reformaté.

Le masquage est un filet, pas une garantie. Ce qui vaut vraiment, c'est de ne pas faire
passer le secret par des endroits qui l'écrivent.

## Les forks

Une PR venue d'un fork s'exécute avec un jeton en **lecture seule** et **sans accès aux
secrets** : `secrets.X` y vaut la chaîne vide. Ce n'est pas une limite à contourner, c'est
ce qui empêche un inconnu d'exfiltrer les clés du dépôt en ouvrant une PR.

D'où le `if` du job de push d'image de Signet :

```yaml
if: github.event_name != 'pull_request'
```

Deux raisons à la fois : le jeton d'une PR de fork ne pourrait pas pousser, et une image
construite depuis du code non fusionné n'a rien à faire au registre.

:::danger
`pull_request_target` s'exécute dans le contexte du dépôt cible : jeton complet, secrets
disponibles, code de la PR à disposition. Un `checkout` du code de la PR suivi d'un
`pnpm install` y exécute du code arbitraire avec tous les droits du dépôt. C'est la faille
classique des workflows Actions. Il n'a de sens que pour poser un label ou un commentaire,
sans jamais faire tourner le code de la PR.
:::

## Injection dans un `run`

Rappel du modèle : `${{ }}` est substitué **dans le texte du script** avant l'exécution.
Une valeur contrôlée par un tiers devient du shell.

```yaml
# Dangereux : un titre de PR contenant `; curl … | sh` s'exécute.
- run: echo "PR: ${{ github.event.pull_request.title }}"

# Correct : le shell reçoit une variable, pas du code.
- env:
    TITLE: ${{ github.event.pull_request.title }}
  run: echo "PR: $TITLE"
```

Sont contrôlés par un tiers : titres et corps de PR et d'issues, noms de branches, messages
de commit, noms d'auteurs. La règle est mécanique — jamais d'interpolation directe de ces
champs dans un `run`, toujours par `env:`.

## Épingler les actions

`actions/checkout@v4` suit un tag mouvant : l'auteur le déplace à chaque correctif. Pratique,
et suffisant pour les actions officielles `actions/*` et `docker/*`. Pour une action tierce
peu connue, l'épinglage au SHA est le seul moyen d'être sûr d'exécuter le code qu'on a lu :

```yaml
uses: une-org/une-action@3f1e8c0a…   # v2.1.0
```

Dependabot sait mettre à jour ces SHA et laisse le commentaire de version à jour.

## Pièges

- **Un secret dans un artefact ou une sortie de job** n'est pas masqué, et un artefact est
  téléchargeable par n'importe qui sur un dépôt public.
- **`secrets` n'est pas disponible dans un `if` de job** sur les anciens runners ; le
  contournement est de recopier la valeur dans une sortie booléenne d'un job précédent.
- **Un `--build-arg` reste dans `docker history`.** Voir
  [Docker et GHCR](/documentation/technique/github-actions/docker-et-ghcr/).
- **Un secret retiré de l'interface reste dans les logs des runs passés.** Il faut supprimer
  les runs, et de toute façon faire tourner la clé.
