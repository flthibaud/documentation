# Base de connaissance

Notes techniques, structures de données et cours de l'IUT.

En ligne : <https://flthibaud.github.io/documentation>

Astro + Starlight, publié sur GitHub Pages à chaque push sur `main`.

## Commandes

```bash
pnpm install
pnpm dev        # http://localhost:4321/documentation
```

| Commande | Effet |
| --- | --- |
| `pnpm dev` | serveur de dev |
| `pnpm build` | build dans `dist/`, vérifie les liens internes |
| `pnpm preview` | sert `dist/` |
| `pnpm check` | types + contenu, sans build |
| `pnpm icones` | régénère les icônes PWA depuis `public/favicon.svg` |

## Organisation

```
src/
├── content/docs/
│   ├── index.mdx                 accueil
│   ├── meta/                     conventions, modèles, déploiement
│   ├── technique/                aide-mémoires, procédures, décisions
│   ├── structures-de-donnees/    fiches par structure
│   └── iut/                      cours
├── components/                   surcharges Starlight (head, tags, sources)
│   └── quiz/                     QCM, en custom elements sans framework
├── pages/
│   ├── tags/                     navigation par tag
│   └── manifest.webmanifest.ts   manifeste PWA
├── lib/url.ts                    liens internes préfixés par le `base`
└── styles/custom.css

integrations/service-worker.mjs   génère dist/sw.js après le build
scripts/generer-icones.mjs        icônes PWA depuis le favicon
```

Sidebar autogénérée depuis l'arborescence : ajouter un fichier suffit.

## Application installable

Le site est une PWA : installable depuis le navigateur mobile, et entièrement disponible
hors ligne — pages, assets et index de recherche sont précachés au premier chargement.

Détails et dépannage sur la page *Publication et déploiement* du site.

## Frontmatter

```yaml
---
title: Titre                 # seul champ obligatoire
description: Une phrase.
tags: [git, outils]
statut: brouillon            # brouillon | en-cours | stable
sources:
  - titre: Doc PostgreSQL
    url: https://…
draft: false                 # exclu du build de prod
---
```

Schéma dans [`src/content.config.ts`](src/content.config.ts). Modèles de fiches sur la page
*Modèles* du site.

## Déploiement

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), déclenché sur push `main`.

Prérequis unique côté GitHub : **Settings → Pages → Source = GitHub Actions**.

## Renommage du dépôt / domaine perso

`SITE` et `BASE` en haut de [`astro.config.mjs`](astro.config.mjs), plus les liens internes
absolus : `grep -rl '/documentation/' src/content`.
