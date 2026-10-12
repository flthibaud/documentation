---
title: AWS et S3 managés
description: Bucket privé et politique IAM minimale sur AWS, et les réglages des S3 managés européens et de Cloudflare R2.
tags: [s3, stockage, securite]
statut: stable
sidebar:
  order: 5
sources:
  - titre: AWS — Blocking public access to your Amazon S3 storage
    url: https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html
  - titre: AWS — Controlling ownership of objects and disabling ACLs
    url: https://docs.aws.amazon.com/AmazonS3/latest/userguide/about-object-ownership.html
  - titre: AWS — Default encryption (SSE-S3)
    url: https://docs.aws.amazon.com/AmazonS3/latest/userguide/default-bucket-encryption.html
  - titre: Scaleway — Object Storage endpoints
    url: https://www.scaleway.com/en/docs/object-storage/concepts/
  - titre: Cloudflare R2 — S3 API compatibility
    url: https://developers.cloudflare.com/r2/api/s3/api/
---

## AWS : ce qui est déjà en place

Sur un bucket créé depuis 2023 :

| Réglage | Valeur par défaut | Conséquence |
| --- | --- | --- |
| Block Public Access | activé | aucune policy ou ACL ne peut rendre le bucket public |
| Object Ownership | `BucketOwnerEnforced` | ACL désactivées : un PUT avec un `x-amz-acl` autre que `bucket-owner-full-control` échoue (`AccessControlListNotSupported`) |
| Chiffrement | SSE-S3 | tous les objets chiffrés au repos, sans rien faire |

Le deuxième point casse les bibliothèques qui envoient une ACL `private` ou `public-read` par
défaut (plugins de CMS, vieux code) : retirer l'option ACL côté client.

## Politique IAM minimale

Un utilisateur IAM (ou mieux, un rôle si l'application tourne chez AWS) par application, limité
à son bucket :

```json title="app-prod-rw.json"
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Sid": "Objects",
			"Effect": "Allow",
			"Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
			"Resource": "arn:aws:s3:::app-prod/*"
		},
		{
			"Sid": "Bucket",
			"Effect": "Allow",
			"Action": "s3:ListBucket",
			"Resource": "arn:aws:s3:::app-prod"
		}
	]
}
```

`ListBucket` porte sur le bucket (ARN sans `/*`), les actions d'objet sur les clés (ARN avec
`/*`) : inverser les deux donne des `AccessDenied` difficiles à lire.

Une URL pré-signée hérite des droits de la clé qui l'a signée, au moment de son utilisation :
révoquer la clé invalide toutes les URL en circulation.

## Les S3 managés européens et R2

Même API, seuls l'endpoint, la région et quelques trous changent.

| Fournisseur | Endpoint | Région | À savoir |
| --- | --- | --- | --- |
| Scaleway | `https://s3.fr-par.scw.cloud` | `fr-par` | aussi `nl-ams`, `pl-waw` |
| OVHcloud | `https://s3.gra.io.cloud.ovh.net` | `gra` | aussi `sbg`, `rbx`… |
| Hetzner | `https://fsn1.your-objectstorage.com` | `fsn1` | aussi `nbg1`, `hel1` |
| Cloudflare R2 | `https://<account_id>.r2.cloudflarestorage.com` | `auto` | pas de frais de sortie ; pas d'ACL |
| Backblaze B2 | `https://s3.<région>.backblazeb2.com` | `us-west-004`… | |

Ces services supportent le virtual-hosted : `forcePathStyle` n'est pas nécessaire, mais ne gêne
pas.

## Quand le managé vaut mieux

- Volume qui dépasse un disque, ou durabilité exigée au-delà d'un seul serveur sans vouloir
  opérer un cluster.
- Sortie de données importante (téléchargements publics) : la bande passante d'un VPS et les
  frais de sortie se comparent mal à R2.
- Contraintes de conformité qui demandent une certification du stockage.

La migration dans un sens ou dans l'autre reste une copie `rclone`
([Exploitation](/documentation/technique/stockage-s3/exploitation/)).
