---
title: Workflows Git en équipe
description: Les deux grands modèles de branches — produit versionné et déploiement continu — ce qui les distingue, et comment on choisit.
tags: [git, workflow, ci, semver]
statut: stable
sources:
  - titre: A successful Git branching model (et sa note de 2020)
    url: https://nvie.com/posts/a-successful-git-branching-model/
  - titre: Trunk Based Development
    url: https://trunkbaseddevelopment.com/
  - titre: Semantic Versioning 2.0.0
    url: https://semver.org/
  - titre: GitHub — About merge queues
    url: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue
---

Le choix d'un modèle de branches ne se discute pas dans l'absolu. Il se déduit d'une seule
question : **est-ce moi qui déploie, ou est-ce quelqu'un d'autre qui installe ?**

Un SaaS contrôle son unique instance en production ; il peut fusionner et déployer vingt
fois par jour, et corriger en avant. Un produit qu'on installe — application self-hosted,
bibliothèque, CLI, app mobile — livre un artefact figé à des gens dont on ne maîtrise ni
la version, ni le moment de la mise à jour, ni la base de données. Ce sont deux contraintes
opposées, et elles produisent deux modèles.

Tout le reste — tags, releases, changelog, feature flags — découle de ça.

## Ce qu'un modèle doit fournir

Quel que soit le camp, il faut répondre à trois besoins :

1. **Un endroit où intégrer** sans mettre en danger ce qui tourne déjà.
2. **Un point de restauration** identifiable et reproductible.
3. **Une frontière** pour pouvoir dire « voilà ce qui a changé entre A et B ».

Les deux modèles répondent aux trois. Ils ne mettent simplement pas la frontière au même
endroit : sur un **tag** pour l'un, sur un **déploiement** pour l'autre.

## Modèle A — Produit versionné

C'est le modèle des projets dont le livrable est un artefact : une image Docker, un binaire,
un paquet npm ou Go, un APK. Gitea, Nextcloud, Immich, PostgreSQL fonctionnent tous ainsi.

### Les branches

```
master  ──●────────────●──────────●───   branche de release, taguée
           ╲          ╱          ╱
develop ────●──●──●──●──●──●──●──●────   intégration continue du travail
             ╲   ╱      ╲    ╱
feat/x        ●─●        ●──●            branches de travail, une PR chacune
```

- `feat/*` et `fix/*` partent de `develop`, y reviennent par PR.
- `develop` accumule ; elle a le droit d'être instable entre deux releases.
- `master` (ou `main`) ne reçoit que des merges de `develop`, et chaque merge est tagué.

Une release, concrètement :

```bash
git checkout master && git merge --no-ff develop
git tag -a v0.2.0 -m "0.2.0"
git push origin master --follow-tags
```

### Le tag est le livrable

C'est le point central du modèle, et celui qu'on néglige en démarrant : **sans tag, un
utilisateur ne peut ni épingler une version, ni revenir en arrière, ni savoir ce qui a
changé**. Une CI correctement câblée transforme le push du tag en tout le reste — image
`:0.2.0`, `:0.2`, `:latest`, numéro de version compilé dans le binaire, GitHub Release avec
ses notes.

Un tag est immuable en pratique. Il est déjà cloné chez les autres, référencé par les
gestionnaires de dépendances, épinglé dans des déploiements ; le déplacer avec `git tag -f`
crée deux réalités selon qu'on a fetché avant ou après. Une release ratée se corrige avec
une nouvelle version, jamais en réécrivant l'ancienne.

### SemVer, lu du bon côté

[SemVer](https://semver.org/lang/fr/) est décrit du point de vue d'une API. Pour une
application qu'on installe, la lecture utile est celle de **l'opérateur** : ce qui casse,
ce n'est pas une signature de fonction, c'est sa mise à jour.

| Changement | Incrément |
| --- | --- |
| Variable d'environnement renommée, supprimée, ou dont le défaut change | majeur |
| Migration destructive, ou dont le `down` ne restaure pas l'état précédent | majeur |
| Version minimale d'une dépendance externe relevée (PostgreSQL, Node…) | majeur |
| Rupture dans une réponse ou une requête de l'API publique | majeur |
| Fonctionnalité, route, variable d'environnement optionnelle | mineur |
| Correctif, performance, documentation | patch |

En `0.x`, une rupture est autorisée entre deux versions mineures — c'est précisément à ça
que sert le `0`. Passer en `1.0.0`, c'est s'engager à ne plus casser sans changer le majeur.

Une release candidate se tague `v0.3.0-rc.1`. Le suffixe après le `-` doit exclure la
version des canaux par défaut : pas de `latest` Docker, pas de « Latest release » GitHub,
pas de `npm install` sans `@next`. Une CI qui ne teste pas ce suffixe pousse une RC sur tous
les déploiements qui suivent `latest`.

### Supporter plusieurs versions

Le jour où des gens tournent en `1.x` pendant que tu développes la `2.0`, une branche de
maintenance apparaît :

```
release/1.x ──●──●──●        correctifs uniquement, tags v1.4.1, v1.4.2…
             ╱
main    ──●─●────────●──●──  la 2.0 en cours
```

Un correctif est développé sur la branche la plus ancienne encore supportée, puis
transporté vers les plus récentes (`git cherry-pick`, ou un bot de backport). L'inverse —
corriger sur `main` puis cherry-picker vers l'arrière — marche aussi mais oublie plus
souvent une branche.

### Le prix à payer

- Chaque changement traverse deux merges (`feat` → `develop` → `master`).
- Un hotfix urgent doit atterrir sur `master` **et** revenir dans `develop`, sinon la
  release suivante réintroduit le bug. C'est la panne classique du modèle.
- `develop` peut diverger longtemps de `master`, et le merge de release devient un
  événement à risque au lieu d'une formalité.

## Modèle B — Déploiement continu (trunk-based)

C'est le modèle des SaaS : GitHub, Shopify, Google. Une seule branche de long terme,
`main`, maintenue **déployable en permanence**.

```
main ──●──●──●──●──●──●──●──●──●──   chaque commit est déployable
        ╲╱    ╲╱    ╲╱   ╲╱
        branches de quelques heures
```

### Ce qui change vraiment

Ce n'est pas « une branche en moins ». Ce sont quatre mécanismes qui remplacent le rôle que
jouait `develop` :

**Les branches sont courtes.** Quelques heures, une journée. Une branche qui vit une semaine
recrée un `develop` privé, avec ses conflits, en pire — personne d'autre ne voit ce qu'il y
a dedans.

**Les feature flags remplacent les branches longues.** Le code d'une fonctionnalité inachevée
est fusionné et déployé, mais désactivé. C'est ce qui découple **déployer** (mettre le code
en production) de **livrer** (l'exposer aux utilisateurs), et c'est la vraie condition
d'entrée du modèle : sans flags, une fonctionnalité de trois semaines n'a nulle part où
attendre. Contrepartie réelle : un flag est une branche `if` permanente, testée dans un seul
de ses deux états, et un flag qu'on ne supprime pas devient de la dette qui se cumule.

**La merge queue arbitre la concurrence.** Deux PR vertes indépendamment peuvent casser
`main` une fois fusionnées ensemble. La file d'attente teste chaque PR *rebasée sur le
résultat des précédentes* avant de fusionner. C'est ce qui rend le modèle tenable au-delà de
quelques dizaines de merges par jour ; en dessous, ça ne sert à rien.

**Le rollback remplace le hotfix.** On ne prépare pas une version corrective : on redéploie
le build précédent, ou on coupe le flag. La correction arrive ensuite, sans urgence.

### Versionner sans SemVer

Il n'y a plus rien à épingler : un seul déploiement existe, celui d'aujourd'hui. La
« version » devient le SHA du commit, un numéro de build incrémental, ou un horodatage —
exposé dans un endpoint de santé et attaché aux traces, pour pouvoir relier une erreur à un
build précis. SemVer redevient pertinent seulement si le SaaS publie une API publique
versionnée, et c'est alors l'API qu'on versionne (`/v1`, `/v2`), pas le dépôt.

### Le vrai point dur : la base de données

Un déploiement se rollback, une migration non. Et pendant un déploiement progressif, les
deux versions du code tournent **en même temps** sur le même schéma. D'où le motif
*expand / contract*, en trois releases séparées :

1. **Expand** — ajouter la nouvelle colonne, nullable. L'ancien code l'ignore.
2. **Migrate** — le nouveau code écrit dans les deux, une tâche de fond remplit l'existant.
3. **Contract** — une fois qu'aucune instance ne lit plus l'ancienne colonne, la supprimer.

Renommer une colonne en une seule migration est la façon la plus fiable de casser une
production en déploiement continu.

### Les environnements

Là où le modèle A a des branches, le modèle B a des étapes de déploiement : environnement
éphémère par PR, staging, puis production par vagues (canari sur 1 % du trafic, puis
élargissement, avec rollback automatique sur les métriques). La progressivité remplace
l'attente sur une branche.

## Choisir

| | Produit versionné | Déploiement continu |
| --- | --- | --- |
| Qui déploie | l'utilisateur | toi |
| Branches longues | `main` + `develop` (+ `release/*`) | `main` seule |
| Frontière de release | un tag | un déploiement |
| Version | SemVer | SHA / build |
| Retour arrière | épingler la version précédente | redéployer, ou couper un flag |
| Urgence | branche de hotfix + release patch | rollback puis correctif normal |
| Changelog | obligatoire, c'est un contrat | interne, pour le débogage |
| Coût d'entrée | discipline de tags et de notes | tests, flags, observabilité |

En pratique :

- **Quelqu'un d'autre installe ton code** → modèle A. Non négociable : sans version, il ne
  peut ni signaler un bug utilement, ni revenir en arrière.
- **Tu déploies, mais quelques fois par mois** → modèle A allégé : `main` + branches de
  travail, tags à chaque mise en production. `develop` ne paie pas son coût si rien
  n'attend jamais en file.
- **Tu déploies plusieurs fois par jour** → modèle B, à condition d'avoir des tests dans
  lesquels tu as confiance. Le trunk-based sans suite de tests sérieuse, ce n'est pas un
  modèle, c'est du push direct sur `main`.
- **Les deux** (SaaS + version self-hosted du même produit, cas GitLab ou Sentry) → `main`
  en continu, et des branches `release/x.y` coupées périodiquement et taguées.

## Ce qui est commun aux deux

- **PR + CI verte obligatoire**, via les règles de protection de branche. Même en solo :
  c'est ce qui empêche le push direct un vendredi soir.
- **Historique lisible.** Le compromis courant : *squash* des PR de fonctionnalité (une PR =
  un commit sur la branche cible), merge commit pour les intégrations. Les commits
  intermédiaires d'une branche n'ont pas de valeur une fois la branche fusionnée.
- **[Conventional Commits](https://www.conventionalcommits.org/)** (`feat:`, `fix:`,
  `chore:`…) — la contrainte de forme qui rend un changelog générable. Le corollaire souvent
  ignoré : quand les notes sont générées depuis les PR, **les titres de PR sont de la
  documentation publique**.
- **Génération du changelog** : notes automatiques GitHub (zéro configuration, source =
  titres de PR), `git-cliff` (un `CHANGELOG.md` versionné, source = commits), ou
  `release-please` (ouvre une PR de release qui bumpe et tague ; suppose une branche unique,
  donc il s'entend mal avec `develop`).
- **CODEOWNERS, Dependabot, `merge_group` dans la CI** : de l'outillage, pas un modèle.

## Git Flow, GitHub Flow, GitLab Flow

Les trois noms qu'on croise, pour situer le vocabulaire :

- **Git Flow** (Vincent Driessen, 2010) — le modèle A dans sa version complète :
  `develop`, `release/*`, `hotfix/*`, `feature/*`. L'auteur a ajouté en 2020 une note en tête
  de son propre article pour dire que si tu livres du logiciel en continu, GitHub Flow est
  probablement le bon choix. Le modèle reste pertinent pour ce pour quoi il a été écrit :
  du logiciel explicitement versionné.
- **GitHub Flow** — le modèle B minimal : `main` + branches courtes + PR + déploiement.
- **GitLab Flow** — un intermédiaire : `main` plus des branches d'environnement
  (`staging`, `production`) dans lesquelles on ne fusionne que vers l'aval. Utile quand le
  déploiement n'est pas entièrement automatisé.

## Pièges

- **`develop` qui dérive.** Si la distance entre `develop` et `main` se compte en mois, le
  merge de release devient l'événement risqué que le modèle était censé éviter. Une release
  fréquente et petite est ce qui rend le modèle A tenable.
- **Le hotfix orphelin.** Corrigé sur `main`, jamais remonté dans `develop` : la release
  suivante réintroduit le bug. À vérifier systématiquement, ou à automatiser.
- **Le tag posé sur la mauvaise branche.** Un tag sur `develop` désigne un état qui n'a
  jamais été publié. Il se tague ce qui se livre.
- **La RC qui déplace `latest`.** Un `v1.0.0-rc.1` traité comme un tag ordinaire par la CI
  atterrit chez tous ceux qui suivent le canal par défaut. Le test est l'absence de `-` dans
  le tag.
- **Le feature flag éternel.** Chaque flag double le nombre de chemins d'exécution
  possibles. Sans date de suppression, le modèle B finit par produire une base de code que
  personne ne peut plus raisonner.
- **La branche de trois semaines dans un dépôt trunk-based.** Elle recrée un `develop`
  invisible des autres, avec un merge final proportionnellement douloureux.

Les commandes de réparation et de fouille sont dans l'[aide-mémoire Git](/documentation/technique/aide-memoire-git/).
