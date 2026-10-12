---
title: MinIO
description: L'état de MinIO depuis l'arrêt de la version communautaire, exploiter une installation existante avec mc, et migrer ailleurs.
tags: [s3, stockage, auto-hebergement]
statut: stable
sidebar:
  order: 3
sources:
  - titre: minio/minio — README (dépôt archivé)
    url: https://github.com/minio/minio
  - titre: MinIO Client (mc) — documentation
    url: https://min.io/docs/minio/linux/reference/minio-mc.html
  - titre: MinIO — Policy-based access control
    url: https://min.io/docs/minio/linux/administration/identity-access-management/policy-based-access-control.html
---

Longtemps le serveur S3 auto-hébergé par défaut. Ce n'est plus le cas, mais on le croise
dans beaucoup d'infrastructures.

## Où en est MinIO

| Date | Événement |
| --- | --- |
| mai 2025 | la console web communautaire perd l'administration (utilisateurs, policies, config) |
| oct. 2025 | fin des binaires et images précompilés : distribution « source only » |
| fin 2025 | dépôt de `mc` archivé (dernier commit en novembre) |
| 2026 | dépôt `minio/minio` archivé ; les images Docker Hub ne sont plus téléchargeables |

La suite s'appelle **AIStor** (Free pour un usage communautaire mono-nœud, Enterprise sous
licence). Le serveur reste en AGPLv3 pour qui le compile.

Conséquence : pas de nouveau déploiement MinIO communautaire. En entreprise, deux cas — une
installation existante à exploiter, ou une licence AIStor. Les commandes sont les mêmes.

## Ce qui le distingue

- Configuration entièrement par variables d'environnement : `MINIO_ROOT_USER`,
  `MINIO_ROOT_PASSWORD`, `MINIO_VOLUMES`, `MINIO_SERVER_URL` (URL publique, utilisée pour
  signer depuis la console).
- Ports : **9000** pour l'API S3, **9001** pour la console.
- Mode distribué par **erasure coding** : un nombre fixe de disques par « server pool »
  (`http://minio{1...4}/data{1...4}`), on agrandit en ajoutant un pool, pas un disque.
- Policies au format IAM AWS, utilisateurs, groupes, comptes de service.

## Exploiter avec `mc`

```bash
mc alias set prod https://s3.example.com "$ROOT_USER" "$ROOT_PASSWORD"

mc admin info prod                         # état des nœuds et des disques
mc mb prod/app-prod                        # créer un bucket
mc anonymous get prod/app-prod             # doit répondre "private"
mc ls --recursive prod/app-prod
```

Un utilisateur applicatif limité à un bucket :

```json title="app-prod-rw.json"
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
			"Resource": ["arn:aws:s3:::app-prod/*"]
		},
		{
			"Effect": "Allow",
			"Action": ["s3:ListBucket", "s3:GetBucketLocation"],
			"Resource": ["arn:aws:s3:::app-prod"]
		}
	]
}
```

```bash
mc admin policy create prod app-prod-rw app-prod-rw.json
mc admin user add prod app-prod "$(openssl rand -hex 32)"
mc admin policy attach prod app-prod-rw --user app-prod
```

Les commandes `mc admin policy add` / `set` des tutoriels anciens ont été remplacées par
`create` / `attach`.

Le CORS se pose par l'API S3 (`aws s3api put-bucket-cors`), comme partout.

## En sortir

Le plan de données est standard, donc la migration est une copie :

```bash
rclone sync minio:app-prod garage:app-prod --checksum --progress
```

Puis changement d'endpoint, de région et de clés côté application. Les policies, utilisateurs
et règles de cycle de vie ne se migrent pas : à recréer dans le modèle du nouveau serveur
(sur Garage, une clé par application et par bucket). Détail sur
[Exploitation](/documentation/technique/stockage-s3/exploitation/).

## Pièges

- `MINIO_SERVER_URL` mal réglé derrière un proxy : les URL générées par la console pointent
  vers l'adresse interne.
- Les images `minio/minio:latest` référencées dans un vieux `compose.yaml` ne se tirent plus :
  un serveur reconstruit de zéro ne redémarre pas. Avoir l'image en cache ou dans un registre
  privé tant que la migration n'est pas faite.
