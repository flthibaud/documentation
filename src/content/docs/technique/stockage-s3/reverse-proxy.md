---
title: Reverse proxy et TLS
description: Exposer l'API S3 derrière nginx, Caddy ou Traefik sans casser les signatures ni les gros uploads.
tags: [s3, stockage, auto-hebergement, securite]
statut: stable
sidebar:
  order: 6
sources:
  - titre: nginx — proxy_pass
    url: https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass
  - titre: Caddy — reverse_proxy
    url: https://caddyserver.com/docs/caddyfile/directives/reverse_proxy
  - titre: Traefik — Services (passHostHeader)
    url: https://doc.traefik.io/traefik/routing/services/
---

Le serveur S3 écoute en HTTP sur localhost ou un réseau Docker ; le reverse proxy porte le TLS
et le nom de domaine. Trois contraintes, toutes vérifiées sur Garage :

| Contrainte | Si elle n'est pas respectée |
| --- | --- |
| transmettre le `Host` d'origine | **403** sur toutes les requêtes signées |
| ne pas réécrire le chemin | **403** sur certaines clés seulement (`//`, selon le proxy) |
| ne pas limiter la taille du corps | **413** au-delà de la limite du proxy |

Un sous-domaine dédié (`s3.example.com`), jamais un sous-chemin (`example.com/s3/`) : le chemin
appartient au bucket et à la clé, et il est signé.

## nginx

```nginx title="/etc/nginx/sites-available/s3.example.com"
server {
    listen 443 ssl;
    http2 on;
    server_name s3.example.com;
    # ssl_certificate … ;

    client_max_body_size 0;          # défaut 1 Mo → 413
    proxy_request_buffering off;     # streamer l'upload au lieu de le mettre sur disque
    proxy_buffering off;
    proxy_read_timeout 300s;

    location / {
        proxy_pass http://127.0.0.1:3900;   # SANS chemin après l'hôte
        proxy_set_header Host $http_host;   # défaut : l'hôte de l'upstream → 403
    }
}
```

Les deux pièges propres à nginx :

- **`Host`** : sans `proxy_set_header`, nginx envoie `127.0.0.1:3900`. La signature a été
  calculée pour `s3.example.com` : 403 sur tout.
- **`proxy_pass` avec une URI** (`http://127.0.0.1:3900/`) : nginx normalise alors le chemin
  avant de le transmettre. Les clés ordinaires passent, mais une clé contenant `//` est
  fusionnée et sa signature casse. Le genre de bug qui n'apparaît qu'en production, sur
  quelques fichiers.

## Caddy

```text title="Caddyfile"
s3.example.com {
	reverse_proxy 127.0.0.1:3900
}
```

Rien d'autre : Caddy transmet le `Host` d'origine, ne réécrit pas le chemin, n'impose pas de
taille maximale par défaut, et gère le certificat. C'est le cas le plus simple.

## Traefik

```yaml title="compose.yaml (labels du service S3)"
labels:
  - traefik.enable=true
  - traefik.http.routers.s3.rule=Host(`s3.example.com`)
  - traefik.http.routers.s3.entrypoints=websecure
  - traefik.http.routers.s3.tls.certresolver=letsencrypt
  - traefik.http.services.s3.loadbalancer.server.port=3900
```

`passHostHeader` vaut `true` par défaut : ne pas le désactiver. Pas de limite de corps par
défaut, sauf si un middleware `buffering` est ajouté.

## Virtual-hosted

Seulement si un client l'impose. Il faut alors :

- un DNS wildcard `*.s3.example.com` ;
- un certificat wildcard, donc un challenge DNS-01 (Caddy et Traefik le font avec le plugin
  de leur fournisseur DNS) ;
- `root_domain = ".s3.example.com"` (Garage), `RUSTFS_SERVER_DOMAINS` (RustFS),
  `MINIO_DOMAIN` (MinIO) ;
- `server_name s3.example.com *.s3.example.com` côté nginx.

## Ce qui ne passe pas par le proxy

- L'API d'administration (Garage 3903, console MinIO ou RustFS 9001) : tunnel SSH
  (`ssh -L 3903:127.0.0.1:3903 serveur`), pas de vhost public.
- Le trafic interne application → stockage : par le réseau privé (`http://s3:3900`), pas
  d'aller-retour par le domaine public. D'où deux endpoints dans l'application
  ([Côté application](/documentation/technique/stockage-s3/cote-application/)).
- Le CORS : il se règle sur le bucket. Des en-têtes `Access-Control-*` ajoutés par le proxy
  font doublon avec ceux du serveur et le navigateur rejette la réponse.

## Vérifier

```bash
# TLS et routage
curl -sI https://s3.example.com/ | head -1          # 403 (accès anonyme refusé) = bon signe

# Accès anonyme à un objet
curl -s -o /dev/null -w '%{http_code}\n' https://s3.example.com/app-prod/un/objet   # 403

# Requête signée de bout en bout
aws --endpoint-url https://s3.example.com --region garage s3 ls s3://app-prod
```
