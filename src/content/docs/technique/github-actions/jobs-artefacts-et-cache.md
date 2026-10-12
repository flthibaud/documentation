---
title: Jobs, artefacts et cache
description: Faire circuler des fichiers entre des machines qui ne se connaissent pas, et ne pas réinstaller le monde à chaque run.
tags: [ci, github, cache, artefact]
statut: stable
sidebar:
  order: 3
sources:
  - titre: GitHub — Store and share data with workflow artifacts
    url: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/store-and-share-data
  - titre: GitHub — Cache dependencies to speed up workflows
    url: https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/cache-dependencies
---

Un job démarre sur une machine vierge : pas de dépôt, pas de dépendances, rien de ce que le
job précédent a produit. Presque tout ce qui suit existe pour contourner ça.

## Ordonner : `needs:`

Sans `needs`, tous les jobs partent en même temps. Le graphe de Signet :

```
frontend ──┬── go ──────────┐
           └── vulncheck ───┴── build-and-push ── release
```

```yaml
jobs:
  frontend: ...
  go:
    needs: frontend
  vulncheck:
    needs: frontend
  build-and-push:
    needs: [frontend, go, vulncheck]
  release:
    needs: [build-and-push]
```

`go` et `vulncheck` tournent en parallèle : la durée totale est celle de la plus longue des
deux branches, pas leur somme. Un job dont une dépendance échoue est **sauté**, pas échoué —
la distinction compte quand on lit un run rouge : le vrai coupable est le premier job en
échec, tout ce qui est gris derrière n'est qu'une conséquence.

## Deux façons de passer quelque chose

| | Sortie de job | Artefact |
| --- | --- | --- |
| Contenu | une chaîne | des fichiers |
| Taille | ~1 Mo au total, tronqué au-delà | jusqu'au quota du dépôt |
| Lecture | `needs.<job>.outputs.<clé>` | `download-artifact` |
| Visible dans l'interface | non | oui, téléchargeable |
| Secrets | **jamais** : une sortie n'est pas masquée | jamais non plus |

Une sortie de job se déclare explicitement, elle ne remonte pas toute seule :

```yaml
jobs:
  version:
    runs-on: ubuntu-latest
    outputs:
      tag: ${{ steps.calc.outputs.tag }}
    steps:
      - id: calc
        run: echo "tag=v1.2.3" >> "$GITHUB_OUTPUT"
```

## Les artefacts, cas Signet

`frontend.go` contient un `go:embed frontend/build/client`, et ce dossier n'est pas commité.
Sans lui, **aucun paquet Go ne compile** — ni `go build`, ni `go vet`, ni `go test`. Le
front doit donc être construit avant tout job Go, et son résultat transporté.

```yaml
# job frontend
- name: Upload frontend build
  uses: actions/upload-artifact@v4
  with:
    name: frontend-build
    path: frontend/build
    retention-days: 1

# jobs go et vulncheck
- name: Download frontend build
  uses: actions/download-artifact@v4
  with:
    name: frontend-build
    path: frontend/build
```

`retention-days: 1` parce que c'est un intermédiaire de build : personne ne le téléchargera,
et la rétention par défaut (90 jours) consomme le quota du dépôt pour rien. À l'inverse, les
rapports Lighthouse de Wacan sont gardés 14 jours — ils servent à comparer.

Deux détails qui piègent une fois chacun :

- **Le nom est unique dans un run.** Depuis la v4, deux uploads du même `name` provoquent une
  erreur au lieu de fusionner. Une matrice doit suffixer : `name: build-${{ matrix.os }}`.
- **Les chemins sont relatifs à la racine du dépôt**, et l'archive est reconstruite à partir
  du répertoire commun le plus proche. Uploader `frontend/build` puis télécharger dans
  `path: frontend/build` restitue bien l'arborescence.

## Le cache

Un artefact transporte un résultat *dans* un run. Le cache transporte des dépendances *entre*
les runs. Ce ne sont pas les mêmes fichiers : on cache un magasin de paquets, jamais un
produit de build.

```yaml
- name: Locate pnpm store
  id: pnpm-store
  working-directory: frontend
  run: echo "path=$(pnpm store path --silent)" >> "$GITHUB_OUTPUT"

- name: Cache pnpm store
  uses: actions/cache@v4
  with:
    path: ${{ steps.pnpm-store.outputs.path }}
    key: ${{ runner.os }}-pnpm-${{ hashFiles('frontend/pnpm-lock.yaml') }}
    restore-keys: ${{ runner.os }}-pnpm-
```

La clé encode ce dont le contenu dépend : l'OS et l'empreinte du lockfile. Tant que le
lockfile ne bouge pas, la clé est identique et le cache est un succès complet. Dès qu'une
dépendance change, la clé change, `restore-keys` retrouve le cache le plus récent qui
commence par le même préfixe, et `pnpm install` ne télécharge que le delta.

:::note
Une entrée de cache est **immuable** : on ne peut pas écrire deux contenus différents sous
la même clé. C'est exactement pourquoi `restore-keys` existe — sans clé variable, le cache
se figerait au premier run et ne verrait jamais les nouvelles dépendances.
:::

L'écriture n'a lieu qu'à la fin d'un job réussi, et seulement si la clé exacte n'existait
pas déjà.

### La version courte

Wacan obtient la même chose en une ligne, parce que `setup-node` sait le faire :

```yaml
- uses: pnpm/action-setup@v4
  with:
    run_install: false
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: pnpm            # + cache-dependency-path: si le lockfile n'est pas à la racine
```

L'ordre n'est pas négociable : `setup-node` cherche le binaire `pnpm` pour localiser le
magasin, il doit donc passer **après** son installation. Signet fait la manœuvre à la main
et active pnpm par `corepack enable`, la version étant épinglée par le champ
`packageManager` de `package.json`.

### Portée et éviction

- Un cache écrit sur une branche est lisible par cette branche et par les branches qui en
  descendent. Une PR lit le cache de sa base ; **elle n'écrit rien de visible ailleurs**.
- Quota de 10 Go par dépôt, éviction LRU, plus tout ce qui n'a pas été touché depuis 7 jours.
- Un cache abîmé ne se répare pas : on change la clé (`v2-${{ runner.os }}-…`) ou on le
  supprime via `gh cache delete`.

## Matrice

```yaml
strategy:
  fail-fast: false
  matrix:
    go: ["1.24.x", "1.25.x"]
```

Un job par combinaison, en parallèle. `fail-fast: false` empêche l'annulation des autres dès
la première défaillance — sans ça, on apprend que « ça casse quelque part » sans savoir où.
Ni Signet ni Wacan n'en utilisent : une seule version de Go, un seul OS cible. Une matrice
sur un projet mono-cible ne fait que multiplier la facture.

## Pièges

- **`actions/checkout` cache l'historique par défaut.** `fetch-depth: 1`, un seul commit.
  Tout ce qui lit l'historique — notes de release depuis le tag précédent, date de dernière
  modification Starlight — a besoin de `fetch-depth: 0`.
- **Cacher `node_modules` directement** est plus rapide en apparence et faux en pratique :
  l'arborescence dépend de la version de Node et de la plateforme, et les scripts
  d'installation ne sont pas rejoués. On cache le magasin, pas l'arbre installé.
- **Mélanger `upload-artifact@v3` et `@v4`** dans le même run : le stockage n'est pas le
  même, le téléchargement ne trouve rien.
- **Un artefact est public sur un dépôt public.** Y déposer un fichier de configuration
  rempli par la CI revient à le publier.
