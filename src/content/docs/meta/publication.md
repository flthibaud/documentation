---
title: Publication et déploiement
description: Chaîne de build, configuration GitHub Pages, base path.
sidebar:
  order: 4
tags: [meta, github, ci]
---

<https://flthibaud.github.io/documentation>

Push sur `main` → `.github/workflows/deploy.yml` → `pnpm install && astro build` →
`actions/deploy-pages`. `dist/` n'est pas versionné.

## Prérequis GitHub

**Settings → Pages → Build and deployment → Source = GitHub Actions**. Sans ça le workflow
s'exécute et échoue à l'étape de déploiement.

## Suivi

```bash
gh run list --workflow=deploy.yml --limit 5
gh run watch
gh run view --log-failed
```

## Local

```bash
pnpm dev        # http://localhost:4321/documentation
pnpm build      # vérifie aussi les liens internes
pnpm preview
```

## Base path

```js
site: 'https://flthibaud.github.io',
base: '/documentation',
```

Project page GitHub, donc servi sous le nom du dépôt. Tous les liens internes absolus des
fiches commencent par `/documentation`.

Renommage du dépôt : mettre à jour `base` et les liens —
`grep -rl '/documentation/' src/content`.

## Domaine perso

1. `site: 'https://mon-domaine.fr'`, `base: '/'`.
2. `public/CNAME` contenant le domaine.
3. `CNAME` DNS vers `flthibaud.github.io`.
4. Retirer le préfixe des liens internes.

## Symptômes

| Symptôme | Cause |
| --- | --- |
| Échec sur « Get Pages site » | Pages pas réglé sur GitHub Actions |
| 404 sur une nouvelle fiche | `draft: true`, ou lien sans préfixe `/documentation` |
| Build cassé sur un frontmatter | champ absent de `src/content.config.ts` |
| Date de mise à jour absente | fichier pas encore commité, ou `fetch-depth` non nul manquant |
