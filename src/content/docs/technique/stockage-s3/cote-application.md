---
title: Côté application
description: Configurer le SDK S3 pour qu'il marche sur tous les serveurs, signer des URL pour le navigateur, tester contre un vrai serveur.
tags: [s3, stockage, securite]
statut: stable
sidebar:
  order: 7
sources:
  - titre: AWS SDK for JavaScript v3 — S3Client configuration
    url: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/s3/
  - titre: AWS SDKs — Data integrity protections
    url: https://docs.aws.amazon.com/sdkref/latest/guide/feature-dataintegrity.html
---

Exemples avec le SDK AWS JavaScript v3 ; les mêmes options existent dans les SDK Python
(`boto3`), Go et Java sous d'autres noms.

## Une configuration qui marche partout

```ts title="storage/client.ts"
import { S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';

const base: S3ClientConfig = {
	region: process.env.S3_REGION,                // 'garage', 'fr-par', 'auto'…
	forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
	credentials: {
		accessKeyId: process.env.S3_ACCESS_KEY_ID!,
		secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
	},
	// Les SDK de 2025+ ajoutent des checksums CRC que les serveurs auto-hébergés
	// ne gèrent pas tous, et qui cassent les URL pré-signées.
	requestChecksumCalculation: 'WHEN_REQUIRED',
	responseChecksumValidation: 'WHEN_REQUIRED',
};

/** Opérations du serveur, par le réseau privé. */
export const internal = new S3Client({ ...base, endpoint: process.env.S3_ENDPOINT });

/** Uniquement pour signer des URL destinées au navigateur. N'envoie jamais de requête. */
export const signer = new S3Client({
	...base,
	endpoint: process.env.S3_PUBLIC_ENDPOINT ?? process.env.S3_ENDPOINT,
});
```

Six variables suffisent à changer de serveur : `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`,
`S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (plus
`S3_FORCE_PATH_STYLE`).

Pourquoi deux clients : le `Host` fait partie de la signature. Une URL signée avec
`http://s3:3900` (réseau Docker) est inutilisable depuis le navigateur, et faire passer le
trafic interne par le domaine public ajoute un aller-retour TLS et une dépendance au DNS.

## Upload direct depuis le navigateur

```ts title="storage/presign.ts"
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { signer } from './client';

export const presignUpload = (key: string, contentType: string, size: number) =>
	getSignedUrl(
		signer,
		new PutObjectCommand({
			Bucket: process.env.S3_BUCKET,
			Key: key,
			ContentType: contentType,
			ContentLength: size,
		}),
		{
			expiresIn: 600,
			// Signés comme en-têtes : le serveur refuse un autre type ou une autre taille.
			signableHeaders: new Set(['content-type', 'content-length']),
		},
	);

export const presignDownload = (key: string, filename: string) =>
	getSignedUrl(
		signer,
		new GetObjectCommand({
			Bucket: process.env.S3_BUCKET,
			Key: key,
			ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
		}),
		{ expiresIn: 300 },
	);
```

Le navigateur doit envoyer exactement le `Content-Type` signé. Le parcours complet :

1. le client déclare nom, type et taille au serveur applicatif, qui vérifie les limites ;
2. le serveur génère une clé (un UUID, jamais le nom d'origine) et l'URL signée ;
3. le navigateur fait le `PUT` ;
4. le client confirme, le serveur fait un `HeadObject` pour lire la taille et le type
   **réels**, puis lit les premiers octets (`Range: bytes=0-4095`) pour vérifier la signature
   de fichier, avant de l'accepter.

L'étape 4 n'est pas redondante : la taille signée est celle déclarée par le client, et le
`Content-Type` est une étiquette, pas une preuve.

Côté navigateur, `fetch` ne donne pas la progression d'un envoi : `XMLHttpRequest` et
`upload.onprogress`. La CSP de la page doit autoriser l'origine du stockage dans
`connect-src`.

## Tester contre un vrai serveur

Les comportements qui comptent (refus d'un type ou d'une taille, accès anonyme, en-tête
`Content-Disposition`) ne se vérifient qu'avec un serveur réel. Garage ou RustFS tournent en
quelques secondes dans un conteneur, en local comme en CI :

```ts title="storage.int.spec.ts (extrait)"
it('refuse un PUT avec une autre taille', async () => {
	const url = await presignUpload(key, 'application/pdf', body.length);
	const res = await fetch(url, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/pdf' },
		body: new Uint8Array(body.length + 1024),
	});
	expect(res.status).toBe(403);
});

it('refuse un accès anonyme', async () => {
	const res = await fetch(`${publicEndpoint}/${bucket}/${key}`);
	expect(res.status).toBe(403);
});
```

Ces tests attrapent aussi les mises à jour du SDK qui changent un comportement par défaut —
le passage aux checksums CRC en 2025 en est l'exemple type.
