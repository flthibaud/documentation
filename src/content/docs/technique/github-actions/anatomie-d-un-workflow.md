---
title: Anatomie d'un workflow
description: La structure du fichier, run vs uses, les contextes ${{ }} et le choix du runner.
tags: [ci, github, workflow, yaml]
statut: stable
sidebar:
  order: 1
sources:
  - titre: GitHub — Workflow syntax for GitHub Actions
    url: https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions
  - titre: GitHub — Contexts
    url: https://docs.github.com/en/actions/reference/contexts-reference
---

## Le squelette

Six clés de premier niveau, dont deux seulement sont obligatoires : `on` et `jobs`.

```yaml title=".github/workflows/ci.yml"
name: CI                              # nom affiché dans l'onglet Actions

on:                                   # les événements qui déclenchent
  push:
    branches: [master, develop]

permissions:                          # droits du jeton donné au workflow
  contents: read

concurrency:                          # ce qui arrive quand deux runs se croisent
  group: ${{ github.workflow }}-${{ github.ref }}

env:                                  # variables visibles par tous les jobs
  GO_VERSION: "1.25.x"

jobs:
  go:                                 # identifiant, sert de cible à `needs:`
    name: Go (vet + test)             # nom affiché
    runs-on: ubuntu-latest            # la machine
    steps:
      - uses: actions/checkout@v4
      - run: go test ./...
```

Le reste — `needs`, `if`, `strategy`, `timeout-minutes`, `outputs` — se déclare dans un job.

## `run` ou `uses`

Une étape est soit une commande, soit une action. Jamais les deux dans la même étape.

| | `run` | `uses` |
| --- | --- | --- |
| Ce que c'est | du shell, exécuté dans le workspace | du code publié sur un dépôt |
| Paramètres | variables d'environnement (`env:`) | `with:` |
| Exemple | `run: pnpm build` | `uses: actions/setup-node@v4` |

`actions/checkout@v4` n'est rien d'autre qu'un dépôt GitHub, à la branche ou au tag `v4`.
Et `v4` est un pointeur mouvant : l'auteur le déplace à chaque `4.x`. C'est pratique pour
les correctifs, c'est aussi la surface d'attaque de la chaîne d'approvisionnement — voir
[Secrets et permissions](/documentation/technique/github-actions/secrets-et-permissions/).

Une action n'est utile que quand elle fait quelque chose que le shell ne fait pas seul :
`setup-node` installe *et* configure le cache, `docker/metadata-action` calcule des tags.
Un `uses:` qui se contente de lancer une commande ajoute une dépendance pour rien.

## Faire circuler une valeur entre deux étapes

Chaque étape est un processus séparé : une variable shell exportée dans l'une n'existe plus
dans la suivante. Le passage se fait par des fichiers dont GitHub donne le chemin.

```yaml {2,5,11}
- name: Locate pnpm store
  id: pnpm-store
  working-directory: frontend
  run: echo "path=$(pnpm store path --silent)" >> "$GITHUB_OUTPUT"

- name: Cache pnpm store
  uses: actions/cache@v4
  with:
    path: ${{ steps.pnpm-store.outputs.path }}
```

L'`id` est ce qui rend l'étape adressable ; sans lui, sa sortie est inaccessible.

| Fichier | Effet |
| --- | --- |
| `$GITHUB_OUTPUT` | `clé=valeur` → lisible par `steps.<id>.outputs.clé` |
| `$GITHUB_ENV` | `clé=valeur` → variable d'environnement des étapes **suivantes** |
| `$GITHUB_PATH` | un chemin par ligne, ajouté au `PATH` |
| `$GITHUB_STEP_SUMMARY` | du Markdown, affiché en tête du run |

Une valeur multi-ligne passe par la syntaxe à délimiteur, sinon seule la première ligne est
prise :

```bash
{
  echo "notes<<EOF"
  cat CHANGELOG.md
  echo "EOF"
} >> "$GITHUB_OUTPUT"
```

D'un **job** à l'autre, ce mécanisme ne marche plus : c'est `jobs.<id>.outputs` ou un
artefact, traité dans [Jobs, artefacts et cache](/documentation/technique/github-actions/jobs-artefacts-et-cache/).

## `${{ }}` est résolu avant le shell

C'est le point qui rend un YAML illisible tant qu'on ne l'a pas intégré : GitHub évalue
l'expression et **colle le résultat dans le fichier de script**, puis lance le shell. Le
shell ne voit jamais `${{ }}`. Une valeur qui contient un guillemet ou un `;` est du code.

Les contextes disponibles :

| Contexte | Contenu | Exemple courant |
| --- | --- | --- |
| `github` | l'événement et le dépôt | `github.ref`, `github.sha`, `github.event_name` |
| `env` | les `env:` déclarés | `env.GO_VERSION` |
| `vars` | variables de dépôt / d'environnement | `vars.REGISTRY_URL` |
| `secrets` | secrets, masqués dans les logs | `secrets.GITHUB_TOKEN` |
| `steps` | sorties et résultats des étapes | `steps.meta.outputs.tags` |
| `needs` | sorties des jobs dont on dépend | `needs.build.outputs.version` |
| `runner` | la machine | `runner.os`, `runner.temp` |
| `matrix` | la combinaison en cours | `matrix.go-version` |

`github.ref` vaut `refs/heads/develop` ou `refs/tags/v0.2.0` — la référence complète, d'où
les `startsWith(github.ref, 'refs/tags/v')` qu'on croise partout. `github.ref_name` donne la
version courte (`develop`, `v0.2.0`).

## Le shell

Par défaut sur Linux, chaque `run` s'exécute en `bash -e` : une commande qui échoue arrête
l'étape. Mais `-e` seul ne couvre ni les variables non définies, ni l'échec au milieu d'un
tube — d'où le `set -euo pipefail` en tête des scripts un peu longs.

```yaml
- name: Build & push image
  run: |
    set -euo pipefail
    IMAGE="${REGISTRY_URL}/${IMAGE_NAME}"
    docker build -t "$IMAGE" .
```

Ici `${REGISTRY_URL}` est une vraie variable shell, pas une interpolation GitHub : elle
vient du bloc `env:` de l'étape. C'est la forme à préférer dès qu'une valeur n'est pas
maîtrisée.

`working-directory:` s'applique à une étape, `defaults.run.working-directory` à tout un job
— utile dans un dépôt où le front vit dans un sous-dossier.

## Le runner

`runs-on: ubuntu-latest` désigne une VM neuve fournie par GitHub. `runs-on: [self-hosted, linux]`
désigne une machine à soi qui écoute la file d'attente du dépôt ; la liste est un jeu de
labels, tous doivent correspondre.

| | Runner GitHub | Runner auto-hébergé |
| --- | --- | --- |
| État entre deux runs | rien ne survit | **tout survit** : caches Docker, `node_modules`, disque |
| Outils | Go, Node, Docker, buildx… préinstallés | ce que tu as installé |
| Accès réseau interne | non | oui (registre privé, VPN) |
| Coût | minutes facturées (gratuit sur dépôt public) | ta machine |
| Concurrence | illimitée en pratique | limitée par le nombre de runners |

La persistance est le vrai piège du runner auto-hébergé : un run peut réussir grâce à un
fichier laissé par le précédent, et le prochain clone propre échouera. C'est aussi pourquoi
Wacan finit par un ménage explicite :

```yaml
- name: Prune dangling images
  if: always()
  run: docker image prune -f
```

`timeout-minutes` vaut 360 par défaut, soit six heures à payer pour un job bloqué. Une
valeur explicite (30 chez Wacan) est le garde-fou.

## Pièges

- **`env:` n'est pas disponible partout.** Ni dans `runs-on`, ni dans un `if` au niveau du
  job. Il l'est dans les étapes. Une valeur nécessaire aux deux se met dans `vars` ou se
  duplique.
- **Une étape qui échoue saute toutes les suivantes.** Un envoi de rapport ou un nettoyage
  a besoin de `if: always()`.
- **`on:` peut être interprété comme le booléen `true`** par certains linters YAML (le
  fameux « truthy value »). GitHub s'en accommode ; c'est un avertissement, pas une panne.
- **Le nom du fichier n'a aucune importance**, seul `name:` s'affiche. Mais deux workflows
  qui portent le même `name:` sont indiscernables dans l'onglet Actions.
