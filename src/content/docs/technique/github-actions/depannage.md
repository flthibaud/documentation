---
title: Dépanner une CI
description: Lire un run rouge, le rejouer, le reproduire en local, et les erreurs qui reviennent.
tags: [ci, github, depannage]
statut: stable
sidebar:
  order: 7
sources:
  - titre: GitHub CLI — gh run
    url: https://cli.github.com/manual/gh_run
  - titre: GitHub — Enabling debug logging
    url: https://docs.github.com/en/actions/how-tos/monitor-workflows/enable-debug-logging
---

## Lire le run

Le premier job **rouge** est le seul intéressant : tout ce qui est gris derrière est sauté
par `needs`, pas cassé. Dans l'interface, l'étape en échec est dépliée automatiquement ;
en ligne de commande :

```bash
gh run list --limit 5                 # les derniers runs, avec leur identifiant
gh run view <id>                      # le détail job par job
gh run view <id> --log-failed         # uniquement les logs des étapes en échec
gh run watch                          # suivre le run en cours
gh run rerun <id> --failed            # ne rejouer que les jobs rouges
gh run download <id>                  # récupérer les artefacts
```

`--log-failed` est ce qui remplace le défilement dans quinze minutes de logs.

### Les logs de débogage

Deux variables de dépôt (Settings → Secrets and variables → Actions → Variables) :

| Variable | Effet |
| --- | --- |
| `ACTIONS_STEP_DEBUG` | les traces internes des actions (`::debug::`) |
| `ACTIONS_RUNNER_DEBUG` | les traces du runner lui-même : réseau, montages, environnement |

Elles s'activent le temps d'un diagnostic, sur `true`, puis se retirent — les logs
deviennent illisibles autrement. Le bouton « Re-run jobs » propose aussi « Enable debug
logging » pour un seul run.

## Reproduire en local

C'est presque toujours plus rapide que de pousser un commit pour voir. La CI de Signet
n'exécute rien d'autre que :

```bash
cd frontend && pnpm install --frozen-lockfile && pnpm typecheck && pnpm build
cd .. && go mod tidy && git diff --exit-code -- go.mod go.sum
go build ./... && go vet ./... && go test -race ./...
```

Ce qui diffère entre la machine locale et le runner, dans l'ordre de fréquence :

1. **Les variables d'environnement.** `CI=true` change le comportement de la plupart des
   outils de test et de build.
2. **La casse du système de fichiers.** Linux distingue `Header.tsx` de `header.tsx`, macOS
   non : un import mal capitalisé passe en local et casse en CI.
3. **Les versions.** `go-version: 1.25.x` ou `node-version: 22` ne sont pas forcément ce qui
   est installé sur la machine.
4. **La fraîcheur des dépendances.** `--frozen-lockfile` refuse d'ajuster le lockfile ; un
   `pnpm install` local, lui, le modifie sans rien dire.
5. **La concurrence.** `-race` et un runner à deux cœurs révèlent des tests qui dépendaient
   de l'ordre d'exécution.

`act` rejoue un workflow dans un conteneur local. Il rend service sur un workflow simple, et
diverge dès qu'il y a du cache, des artefacts, des services ou un runner auto-hébergé. Pour
déboguer un YAML, un dépôt de test et des pushes rapides restent plus fidèles.

## Les erreurs qui reviennent

| Message | Cause |
| --- | --- |
| `Resource not accessible by integration` | il manque une portée dans `permissions` du job |
| `denied: permission_denied: write_package` | pas de `packages: write`, ou nom d'image en majuscules |
| `pattern frontend/build/client: no matching files found` | le `go:embed` de Signet sans l'artefact du job `frontend` |
| `ERR_PNPM_OUTDATED_LOCKFILE` | `package.json` modifié sans régénérer `pnpm-lock.yaml` |
| `git diff --exit-code` rouge sur `go.mod` | un `go mod tidy` non commité |
| `Unable to find artifact` | un nom qui ne correspond pas, ou un mélange `@v3`/`@v4` |
| `tag v0.2.0 not found` sur `gh release create --verify-tag` | le tag n'a pas été poussé |
| `Input required and not supplied: token` | un secret vide, typiquement une PR de fork |
| Le workflow ne part pas du tout | filtres `branches`/`tags` qui ne matchent pas, ou fichier absent de la branche par défaut pour `schedule`/`workflow_dispatch` |

## Les pannes qui ne disent pas leur nom

### Le job qui reste bloqué

Un serveur lancé en arrière-plan sans attente de disponibilité, et le job attend son
`timeout-minutes`. Le motif correct est celui de Wacan :

```bash
pnpm start --port 3000 &
SERVER_PID=$!
trap 'kill "${SERVER_PID}" 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  curl -sf http://localhost:3000/ -o /dev/null && break
  sleep 1
done
curl -sf http://localhost:3000/ -o /dev/null   # échoue franchement si le serveur n'est pas là
```

Le `trap` tue le serveur quoi qu'il arrive, et le `curl` final transforme un timeout de
trente minutes en un échec immédiat et lisible.

### Le job rouge par intermittence

Trois sources, dans cet ordre : un test qui dépend du temps ou de l'ordre (visible avec
`-race`), une ressource réseau externe, un port déjà occupé. Un `rerun` vert ne prouve rien.

### « Ça marchait hier »

Sans changement de code, la cause est ailleurs : un tag mouvant d'action déplacé par son
auteur, l'image `ubuntu-latest` qui a changé de version majeure, une dépendance publiée avec
une plage `^`, ou un cache restauré depuis une clé partielle. `govulncheck@latest` et
`staticcheck: version: latest` de Signet appartiennent à cette catégorie : ils peuvent
rougir sur un commit qui ne touche à rien, et c'est le comportement voulu.

### Le runner auto-hébergé

Symptômes propres à Wacan et à toute machine persistante :

- **Disque plein.** Les images Docker s'accumulent, d'où le `docker image prune -f` final ;
  un `docker system prune` périodique en tâche cron est le complément.
- **Un run qui réussit grâce aux restes du précédent.** Un `node_modules` ou un `.next`
  laissé sur place masque une dépendance manquante. Test décisif : supprimer le dossier de
  travail du runner et relancer.
- **Un run en attente sans fin.** Les labels de `runs-on` ne correspondent à aucun runner en
  ligne, ou le seul runner est occupé par un job précédent qui ne se termine pas.

## Après coup

- Un `if: always()` sur l'envoi des rapports : c'est quand le job échoue qu'on veut les lire.
- `$GITHUB_STEP_SUMMARY` accepte du Markdown affiché en tête du run — le résumé qu'on aurait
  cherché dans les logs.
- Les minutes ne sont facturées que sur les dépôts privés, mais un job bloqué à six heures
  reste six heures pendant lesquelles la file n'avance pas.
