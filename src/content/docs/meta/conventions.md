---
title: Conventions d'écriture
description: Frontmatter, nommage des fichiers, structure d'une fiche et liens internes.
sidebar:
  order: 2
tags: [meta]
---

## Frontmatter

Champs disponibles sur toutes les fiches :

```yaml
---
title: Titre de la fiche          # obligatoire
description: Une phrase.          # recommandé (SEO + résultats de recherche)
tags: [sql, index, performance]   # optionnel, en minuscules
statut: stable                    # brouillon | en-cours | stable (défaut : stable)
sidebar:
  order: 1                        # optionnel, pour forcer la position dans la barre latérale
sources:                          # optionnel, les liens qui ont servi à écrire la fiche
  - titre: PostgreSQL — Index Types
    url: https://www.postgresql.org/docs/current/indexes-types.html
draft: false                      # true = exclu du site publié
---
```

`title` est le seul champ obligatoire.

## Nommage

- Minuscules, tirets, sans accents : `tables-de-hachage.md`.
- Le nom devient l'URL — un renommage casse les liens entrants.
- `index.md` / `index.mdx` = page d'accueil du dossier.
- Sous-dossier par thème à partir d'une demi-douzaine de fiches.

## Tags

Singulier, minuscules, sans accents : `arbre`, pas `Arbres` ni `arborescence`. Trois à cinq
par fiche. Vérifier l'existant sur [Parcourir par tag](/documentation/tags/) avant d'en
créer un — un tag orphelin ne sert à rien.

## Structure d'une fiche

Le `h1` vient du `title` du frontmatter : pas de `#` dans le corps, commencer aux `##`.

Ordre qui marche : ce que c'est (deux phrases), comment s'en servir (exemple qui tourne),
où ça casse (pièges et limites).

## Liens internes

Préfixe `/documentation` obligatoire sur les liens absolus (c'est le `base`) :

```markdown
[Complexité](/documentation/structures-de-donnees/complexite/)
```

## Composants

Encarts en `.md` :

```markdown
:::note
Une information utile mais non critique.
:::

:::caution
Un piège classique.
:::

:::danger
Quelque chose qui casse la production.
:::
```

`Tabs`, `Steps`, `FileTree`, `Card` demandent un fichier `.mdx` et un import :

```mdx
import { Tabs, TabItem } from '@astrojs/starlight/components';

<Tabs>
	<TabItem label="pnpm">`pnpm add astro`</TabItem>
	<TabItem label="npm">`npm install astro`</TabItem>
</Tabs>
```

Renommer un `.md` en `.mdx` ne change pas l'URL : le slug vient du nom sans extension.

## Composants interactifs

`Quiz` teste un point précis de la fiche, en fin de fiche, sous un `## Se tester`. Squelette
sur [Modèles](/documentation/meta/modeles/).

Trois à quatre questions maximum, sur ce qui se retient mal — un piège, une complexité qu'on
confond, une règle qui a une exception. Les mauvais choix doivent être des erreurs qu'on fait
vraiment, pas des remplissages. La correction dit pourquoi les autres sont fausses.

Questions et choix sont mélangés à chaque chargement : ne jamais écrire un choix qui renvoie
à une position (« les deux premières », « aucune des réponses ci-dessus »). Si l'ordre compte,
`<Quiz ordonne>` ou `<Question ordonnee>`.

Le contenu du quiz est exclu de la recherche du site : les corrections ne remontent pas dans
les résultats.

## Blocs de code

Langage systématique, `title` quand c'est un fichier réel :

````markdown
```ts title="src/lib/url.ts" {3}
const base = import.meta.env.BASE_URL;
```
````

`{3}` surligne la ligne 3. `ins={2}` / `del={4}` marquent des ajouts et suppressions.
