---
title: Garage
description: Déployer Garage sur un serveur ou en cluster, initialiser le layout, créer clés et buckets, sauvegarder les métadonnées.
tags: [s3, stockage, auto-hebergement, docker]
statut: stable
sidebar:
  order: 2
sources:
  - titre: Garage — Quick start
    url: https://garagehq.deuxfleurs.fr/documentation/quick-start/
  - titre: Garage — Configuration file format
    url: https://garagehq.deuxfleurs.fr/documentation/reference-manual/configuration/
  - titre: Garage — Admin API
    url: https://garagehq.deuxfleurs.fr/documentation/reference-manual/admin-api/
  - titre: Garage — Recovering from failures
    url: https://garagehq.deuxfleurs.fr/documentation/operations/recovering/
---

Serveur S3 en Rust, développé par Deuxfleurs (association française). Pensé pour des nœuds
modestes et éloignés les uns des autres : chaque objet est découpé en blocs répliqués sur
plusieurs zones. Un seul binaire statique, image Docker `dxflrs/garage` sans shell.

Testé ici avec **Garage v2.4.1**.

## Les trois ports

| Port | Rôle | Exposition |
| --- | --- | --- |
| 3900 | API S3 | via le reverse proxy |
| 3901 | RPC entre nœuds | réseau privé entre nœuds uniquement |
| 3903 | API d'administration (token) | jamais publique : localhost ou tunnel SSH |

Il existe aussi 3902 (hébergement de sites statiques) et 3904 (API K2V), désactivés si leur
section est absente de la config.

## Un nœud, avec Docker Compose

```toml title="garage.toml"
metadata_dir = "/var/lib/garage/meta"
data_dir = "/var/lib/garage/data"
db_engine = "sqlite"
replication_factor = 1

rpc_bind_addr = "[::]:3901"
rpc_public_addr = "127.0.0.1:3901"
rpc_secret = "<openssl rand -hex 32>"

[s3_api]
s3_region = "garage"            # la région que les clients devront annoncer
api_bind_addr = "[::]:3900"
# root_domain = ".s3.example.com" # seulement pour le virtual-hosted

[admin]
api_bind_addr = "[::]:3903"
admin_token = "<openssl rand -base64 32>"
```

```yaml title="compose.yaml"
services:
  garage:
    image: dxflrs/garage:v2.4.1
    restart: unless-stopped
    ports:
      - '127.0.0.1:3900:3900' # le reverse proxy tourne sur l'hôte
      - '127.0.0.1:3903:3903'
    volumes:
      - ./garage.toml:/etc/garage.toml:ro
      - /srv/garage/meta:/var/lib/garage/meta
      - /srv/garage/data:/var/lib/garage/data
```

`meta` et `data` séparés : les métadonnées (SQLite ou LMDB) veulent un SSD, les données
peuvent aller sur un disque lent et gros.

`rpc_secret` et `admin_token` peuvent sortir du fichier : variables `GARAGE_RPC_SECRET` et
`GARAGE_ADMIN_TOKEN`, ou `rpc_secret_file` / `admin_token_file` dans la config.

Hors Docker, le binaire statique se lance tel quel (`garage -c /etc/garage.toml server`) sous
un service systemd.

## Initialiser : layout, clé, bucket

Un nœud qui démarre n'a **aucun rôle** : tant que le layout n'est pas appliqué, l'API S3
répond en erreur et `/health` en 503. Le CLI est dans l'image :

```bash
alias garage='docker compose exec garage /garage'

garage status                                  # récupérer l'ID du nœud (16 premiers caractères suffisent)
garage layout assign -z dc1 -c 100G <node_id>  # zone + capacité
garage layout apply --version 1

garage key create app-prod                     # génère GK… et le secret, affichés une fois
garage bucket create app-prod
garage bucket allow --read --write app-prod --key app-prod
garage key info app-prod --show-secret         # pour réafficher le secret
```

La **capacité** est un poids relatif entre nœuds pour répartir les données, pas un quota.

### Le même travail par l'API d'administration

Utile pour un script d'init idempotent (CI, provisioning). Tout passe par
`POST /v2/<Opération>` avec `Authorization: Bearer <admin_token>` :

```bash
api() { curl -sS --fail-with-body -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' "$@"; }
A=http://127.0.0.1:3903/v2

node=$(api $A/GetClusterStatus | sed -n 's/.*"id": *"\([0-9a-f]\{64\}\)".*/\1/p' | head -n 1)
api -X POST $A/UpdateClusterLayout -d "{\"roles\":[{\"id\":\"$node\",\"zone\":\"dc1\",\"capacity\":100000000000,\"tags\":[]}]}"
api -X POST $A/ApplyClusterLayout -d '{"version":1}'
api -X POST $A/CreateBucket -d '{"globalAlias":"app-prod"}'
api -X POST $A/ImportKey -d '{"accessKeyId":"GK…","secretAccessKey":"…","name":"app-prod"}'
api -X POST $A/AllowBucketKey -d '{"bucketId":"…","accessKeyId":"GK…","permissions":{"read":true,"write":true,"owner":false}}'
```

`ImportKey` permet de fixer la clé soi-même (pratique pour un `.env` connu d'avance) :
`GK` + 24 caractères hexadécimaux, secret de 64 caractères hexadécimaux. Pour l'idempotence,
tester l'existence avant de créer : `GET /v2/GetBucketInfo?globalAlias=…` et
`GET /v2/GetKeyInfo?id=…` répondent 404 si l'objet n'existe pas.

### Le CORS

Garage n'a pas de commande CLI pour le CORS : il se pose via l'API S3, avec une clé `owner` ou
`write` sur le bucket.

```bash
aws --endpoint-url http://127.0.0.1:3900 --region garage s3api put-bucket-cors \
  --bucket app-prod --cors-configuration file://cors.json
```

## Un cluster

Trois nœuds dans trois zones, `replication_factor = 3` : chaque bloc existe dans chaque zone,
un nœud entier peut tomber.

1. Même `garage.toml` sur chaque nœud, **même `rpc_secret`**, `rpc_public_addr` = l'adresse
   joignable par les autres nœuds (réseau privé ou WireGuard).
2. Relier les nœuds : `garage node id` sur chaque nœud donne `<id complet>@<ip>:3901`, à
   passer à `garage node connect` depuis l'un d'eux (ou à lister dans `bootstrap_peers`).
3. Un `layout assign` par nœud avec sa zone, puis un seul `layout apply`.

`replication_factor` ne se change pas sur un cluster en service. Le choisir au départ.

Avec `replication_factor = 3`, lectures et écritures demandent une majorité (quorum de 2) :
le cluster fonctionne avec deux nœuds sur trois, et répond `503 Could not reach quorum` avec
un seul. Un nœud arrêté n'apparaît dans `FAILED NODES` qu'au bout d'environ une minute.

Les nœuds se retrouvent par l'adresse qu'ils ont apprise. Si elle change (conteneur
redémarré, IP dynamique), ils restent déconnectés : relancer `garage node connect`, ou
déclarer `bootstrap_peers` dans la config.

Remplacer un nœud mort : `garage layout assign --replace <ancien_id> -z <zone> -c <cap> <nouvel_id>`,
puis `apply` ; les blocs se reconstruisent depuis les autres zones.

## Sauvegarde et intégrité

- **Métadonnées** : c'est la partie critique (l'index de tous les objets).
  `garage meta snapshot` (`--all` sur tout le cluster), ou automatique avec
  `metadata_auto_snapshot_interval = "6h"` dans la config. Les instantanés sont écrits dans
  `metadata_dir/snapshots/` (ou `metadata_snapshots_dir`) : à copier hors du serveur avec les
  données.
- **Données** : en mono-nœud, rien ne remplace une copie hors serveur
  (`rclone sync`, voir [Exploitation](/documentation/technique/stockage-s3/exploitation/)).
- **Intégrité** : `garage repair scrub start` relit tous les blocs et vérifie leurs
  sommes ; `garage repair blocks` resynchronise ce qui manque.

## Ce que Garage ne fait pas

- **Pas de chiffrement au repos géré par le serveur** : seulement SSE-C (le client fournit la
  clé à chaque requête). Sinon, disque chiffré (LUKS) sous `data_dir` et `metadata_dir`.
- **Pas de policies ni d'ACL** : droits par clé et par bucket (`read`, `write`, `owner`). Les
  en-têtes `x-amz-acl` sont acceptés et ignorés.
- **Pas de versioning d'objets**, pas de verrouillage d'objet (object lock).
- **Pas de console web** officielle ; `garage-webui` est un projet communautaire.

## Pièges

- `s3_region` doit être exactement la région annoncée par les clients, sinon toutes les
  signatures échouent.
- Le `rpc_public_addr` en `127.0.0.1` ne convient qu'au mono-nœud.
- Le nœud garde son identité dans `metadata_dir/node_key` : perdre `meta`, c'est perdre le
  nœud, pas seulement l'index.
