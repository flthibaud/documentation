## Ton et niveau de rédaction

L'auteur est développeur. Écrire pour un pair, pas pour un débutant.

À ne pas faire, ni dans le contenu du site, ni dans le README, ni dans les réponses :

- Rappeler des évidences du métier (ne pas commiter de secrets, faire des sauvegardes,
  le dépôt est public, etc.).
- Justifier un comportement normal de l'outillage (« c'est normal que la racine renvoie
  un 404 », « attention, `pop(0)` est en O(n) » quand c'est déjà dit une fois).
- Ajouter de la motivation ou du coaching (« mieux vaut une fiche imparfaite que pas de
  fiche », « écris d'abord, range ensuite », « c'est déjà la moitié de la révision »).
- Paraphraser ce que le code montre déjà.

Ce qui est attendu : le fait technique, les contraintes réelles, les arbitrages. Court.
Les pièges valent d'être écrits quand ils sont non évidents ou coûteux — pas quand ils
relèvent du réflexe de base.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
