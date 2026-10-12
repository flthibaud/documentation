---
title: RustFS
description: Déployer RustFS en Docker, ses variables d'environnement et ses pièges.
tags: [s3, stockage, auto-hebergement, docker]
statut: stable
sidebar:
  order: 4
sources:
  - titre: rustfs/rustfs — GitHub
    url: https://github.com/rustfs/rustfs
  - titre: RustFS — Documentation
    url: https://docs.rustfs.com/
---

Serveur S3 en Rust, sous licence Apache 2.0, positionné comme remplaçant de MinIO : mêmes
ports, même modèle (configuration par variables d'environnement, console web, policies IAM).
Projet jeune : 1.0 en 2026.

Testé ici avec **RustFS 1.0.0**.

## Déployer

```yaml title="compose.yaml"
services:
  rustfs:
    image: rustfs/rustfs:1.0.0
    restart: unless-stopped
    environment:
      RUSTFS_ACCESS_KEY_FILE: /run/secrets/rustfs_access_key
      RUSTFS_SECRET_KEY_FILE: /run/secrets/rustfs_secret_key
      RUSTFS_CONSOLE_ENABLE: 'true'
    ports:
      - '127.0.0.1:9000:9000' # API S3
      - '127.0.0.1:9001:9001' # console
    volumes:
      - /srv/rustfs/data:/data
    secrets: [rustfs_access_key, rustfs_secret_key]

secrets:
  rustfs_access_key:
    file: ./secrets/access_key
  rustfs_secret_key:
    file: ./secrets/secret_key
```

Les identifiants passés ici sont ceux du **compte root**. Sans eux, l'image démarre quand même,
avec `rustfsadmin` / `rustfsadmin` et un simple avertissement dans les logs. RustFS accepte
aussi les variables `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`, ce qui facilite la reprise d'un
`compose.yaml` MinIO. En multi-nœud, `RUSTFS_RPC_SECRET` est obligatoire si les identifiants
root sont ceux par défaut.

| Variable | Rôle |
| --- | --- |
| `RUSTFS_ACCESS_KEY` / `RUSTFS_SECRET_KEY` (ou `*_FILE`) | identifiants root |
| `RUSTFS_VOLUMES` | chemins de données (`/data` par défaut) |
| `RUSTFS_ADDRESS` | adresse d'écoute de l'API S3 |
| `RUSTFS_CONSOLE_ENABLE`, `RUSTFS_CONSOLE_ADDRESS` | console web |
| `RUSTFS_REGION` | région annoncée |
| `RUSTFS_SERVER_DOMAINS` | domaines pour le virtual-hosted |
| `RUSTFS_KMS_ENABLE`, `RUSTFS_KMS_BACKEND`… | chiffrement côté serveur (KMS local ou Vault) |

`rustfs server --help` dans l'image liste l'ensemble.

## Initialiser

- **Bucket et CORS** : par l'API S3, avec les identifiants root ou un utilisateur
  `owner` :

  ```bash
  export AWS_ACCESS_KEY_ID=… AWS_SECRET_ACCESS_KEY=… AWS_DEFAULT_REGION=us-east-1
  aws --endpoint-url http://127.0.0.1:9000 s3api create-bucket --bucket app-prod
  aws --endpoint-url http://127.0.0.1:9000 s3api put-bucket-cors --bucket app-prod \
    --cors-configuration file://cors.json
  ```

- **Utilisateur applicatif et policy** : depuis la console (port 9001), au format IAM
  (même JSON que sur [MinIO](/documentation/technique/stockage-s3/minio/)). L'application
  n'utilise jamais le root.

## Pièges

- **Volume monté** : le processus tourne sous l'UID **10001**. Un répertoire de l'hôte
  appartenant à root fait échouer le démarrage : `chown -R 10001:10001 /srv/rustfs/data`.
- **Console** : `RUSTFS_CONSOLE_CORS_ALLOWED_ORIGINS` vaut `*` dans l'image. Ne pas
  publier le port 9001, ou restreindre la variable.
- **Maturité** : versions rapprochées et changements de comportement entre versions. Épingler
  le tag (jamais `latest`) et relire les notes de version avant de monter.
