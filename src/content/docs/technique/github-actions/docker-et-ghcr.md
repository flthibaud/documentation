---
title: Docker et GHCR
description: Builder une image dans la CI, la taguer correctement, la pousser sur le registre GitHub.
tags: [ci, github, docker, ghcr]
statut: stable
sidebar:
  order: 4
sources:
  - titre: docker/metadata-action — README
    url: https://github.com/docker/metadata-action
  - titre: docker/build-push-action — README
    url: https://github.com/docker/build-push-action
  - titre: GitHub — Working with the Container registry
    url: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
---

Quatre étapes, toujours les mêmes : préparer buildx, s'authentifier au registre, calculer
les tags, builder et pousser.

```yaml
- uses: docker/setup-buildx-action@v3

- uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}

- id: meta
  uses: docker/metadata-action@v5
  with:
    images: ghcr.io/${{ github.repository }}

- uses: docker/build-push-action@v6
  with:
    context: .
    push: true
    tags: ${{ steps.meta.outputs.tags }}
    labels: ${{ steps.meta.outputs.labels }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

`setup-buildx-action` remplace le builder Docker classique par BuildKit, ce qui débloque le
cache distant, les builds multi-architectures et le parallélisme entre étapes du Dockerfile.
Sans lui, `cache-from: type=gha` est ignoré en silence.

## Le calcul des tags

C'est la partie qui paraît magique et qui ne l'est pas. `metadata-action` prend une liste de
règles et produit une liste de tags, une par ligne, à partir de la référence qui a déclenché
le run.

```yaml title=".github/workflows/ci.yml — Signet"
tags: |
  type=ref,event=branch
  type=semver,pattern={{version}}
  type=semver,pattern={{major}}.{{minor}}
  type=sha
  type=raw,value=dev,enable=${{ github.ref == 'refs/heads/develop' }}
flavor: |
  latest=${{ github.ref == 'refs/heads/master' || (startsWith(github.ref, 'refs/tags/v') && !contains(github.ref, '-')) }}
```

| Règle | Sur un push `develop` | Sur le tag `v0.2.0` | Sur le tag `v0.3.0-rc.1` |
| --- | --- | --- | --- |
| `type=ref,event=branch` | `develop` | — | — |
| `type=semver,{{version}}` | — | `0.2.0` | `0.3.0-rc.1` |
| `type=semver,{{major}}.{{minor}}` | — | `0.2` | — |
| `type=sha` | `sha-1a2b3c4` | `sha-1a2b3c4` | `sha-1a2b3c4` |
| `type=raw,value=dev` | `dev` | — | — |
| `flavor: latest` | — | `latest` | — |

Une règle qui ne s'applique pas ne produit rien : `type=semver` est muet hors d'un tag, et
`{{major}}.{{minor}}` est volontairement muet sur une pré-version — `0.3` doit désigner la
0.3.0 finale, pas sa RC.

La règle `latest` mérite son commentaire dans le fichier : `docker-compose.yml` s'en sert
par défaut, donc une RC qui déplacerait `latest` atterrirait sur toutes les installations
qui n'ont jamais fixé `SIGNET_TAG`. SemVer plaçant la pré-version derrière un `-`, son
absence est tout le test.

### La sortie `version`

`metadata-action` expose aussi `steps.meta.outputs.version` : le numéro SemVer sur un tag,
le nom de la branche sinon. Signet l'injecte dans le build, qui le grave dans le binaire :

```yaml
build-args: |
  VERSION=${{ steps.meta.outputs.version }}
```

```docker title="Dockerfile"
ARG VERSION=dev
RUN CGO_ENABLED=0 go build -ldflags="-X main.version=${VERSION}" -o /app/bin/api ./cmd/api
```

C'est ce qui permet de relier un conteneur qui tourne à un commit : `/v1/healthcheck` répond
`0.2.0` ou `develop`, sans fichier de version à maintenir dans le dépôt.

## Le cache de build

```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

Les couches sont stockées dans le cache Actions du dépôt. `mode=max` conserve aussi les
couches des étapes intermédiaires — sur un Dockerfile multi-étages comme celui de Signet
(build pnpm → build Go → image alpine finale), le mode par défaut ne garderait que l'image
finale et rebuilderait tout à chaque fois.

Le cache ne sert que si le Dockerfile est ordonné pour ça : dépendances copiées et
installées **avant** le code source, sinon chaque modification de source invalide tout ce
qui suit.

```docker
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN corepack pnpm install --frozen-lockfile
COPY frontend/ ./          # ← seule cette couche change quand le code bouge
```

## L'autre approche : docker à la main

Wacan tourne sur un runner auto-hébergé, pousse vers un registre privé et n'utilise aucune
action Docker :

```yaml
IMAGE="${REGISTRY_URL}/${IMAGE_NAME}"
TAGS=("${IMAGE}:sha-${SHA}" "${IMAGE}:${BRANCH}")
if [ "${BRANCH}" = "master" ]; then
  TAGS+=("${IMAGE}:latest")
fi
docker build --pull \
  --build-arg NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL}" \
  --label "org.opencontainers.image.revision=${SHA}" \
  "${TAG_ARGS[@]}" .
```

| | Signet (actions) | Wacan (shell) |
| --- | --- | --- |
| Tags | déduits des règles `metadata-action` | construits dans un tableau bash |
| Labels OCI | générés | écrits à la main, trois sur la dizaine possible |
| Cache | `type=gha` | le cache local du runner, qui survit entre les runs |
| Login | `docker/login-action` | déjà fait sur la machine |
| Lisibilité | il faut connaître les règles | tout est sous les yeux |

Sur un runner auto-hébergé, le cache local rend `type=gha` inutile ; c'est le seul contexte
où la version shell n'est pas un recul. Dès qu'il y a des tags SemVer à calculer, la table
de règles est plus fiable qu'un `if` bash.

## Les variables de build de Next.js

Le bloc `NEXT_PUBLIC_*` de Wacan est passé en `--build-arg` parce que Next **inline** ces
valeurs dans le bundle JavaScript à la compilation : les fournir au démarrage du conteneur
serait trop tard, la page les contient déjà.

:::caution
Un `--build-arg` reste inscrit dans l'historique de l'image (`docker history`). Pour des
valeurs `NEXT_PUBLIC_*`, publiques par construction, c'est sans conséquence. Y faire passer
une clé d'API serveur, c'est la publier avec l'image, même si le `Dockerfile` ne l'écrit
nulle part. Un vrai secret de build passe par `RUN --mount=type=secret`.
:::

## GHCR

L'image s'appelle `ghcr.io/<propriétaire>/<dépôt>`, d'où `${{ github.repository }}`. Le
`GITHUB_TOKEN` suffit à pousser, à condition que le job le demande :

```yaml
permissions:
  contents: read
  packages: write
```

- **Le nom doit être en minuscules.** `${{ github.repository }}` reprend la casse du dépôt ;
  `flthibaud/Signet` échoue au push. Signet s'en sort parce que `metadata-action` normalise
  la casse — un `docker push` écrit à la main, non.
- La première image publiée est **privée** par défaut, même sur un dépôt public. La rendre
  publique se fait une fois, dans les réglages du package.
- Le package n'est pas rattaché au dépôt tant que le label
  `org.opencontainers.image.source` n'est pas posé — `metadata-action` le fait, Wacan le
  fait à la main.

## Multi-architecture

```yaml
- uses: docker/setup-qemu-action@v3
- uses: docker/build-push-action@v6
  with:
    platforms: linux/amd64,linux/arm64
```

L'`arm64` émulé par QEMU sur un runner `amd64` multiplie le temps de build par trois à cinq
pour une compilation Go ou un `pnpm build`. Tant que la cible est un serveur x86, ça ne paie
pas ; le jour où l'image doit tourner sur un Raspberry Pi ou un Mac ARM, c'est ces deux
lignes plus un runner ARM natif pour que ça reste supportable.
