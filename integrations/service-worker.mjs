import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Rien à gagner à les garder hors ligne, et `sw.js` ne se précache pas lui-même. */
const EXCLUS = [/^sw\.js$/, /^sitemap[^/]*\.xml$/, /^\.nojekyll$/];

async function lister(dossier, racine) {
	const entrees = await readdir(dossier, { withFileTypes: true });
	const fichiers = [];
	for (const entree of entrees) {
		const complet = path.join(dossier, entree.name);
		if (entree.isDirectory()) fichiers.push(...(await lister(complet, racine)));
		else fichiers.push(path.relative(racine, complet).split(path.sep).join('/'));
	}
	return fichiers;
}

/**
 * `dist/technique/index.html` est servi à l'URL `/documentation/technique/`.
 * Précacher le chemin du fichier ne matcherait jamais la requête de navigation.
 */
function versUrl(chemin, portee) {
	if (chemin === 'index.html') return portee;
	if (chemin.endsWith('/index.html')) return portee + chemin.slice(0, -'index.html'.length);
	return portee + chemin;
}

/**
 * Écrit `dist/sw.js` après le build : précache l'intégralité du site (pages,
 * assets hashés, index Pagefind, icônes), ce qui rend la recherche et toutes
 * les fiches disponibles hors ligne dès la première visite.
 *
 * @param {{ base?: string }} options
 */
export function serviceWorker({ base = '/' } = {}) {
	const portee = `/${base}/`.replace(/\/+/g, '/');

	return {
		name: 'kb:service-worker',
		hooks: {
			'astro:build:done': async ({ dir, logger }) => {
				const racine = fileURLToPath(dir);
				const tous = await lister(racine, racine);
				const retenus = tous.filter((f) => !EXCLUS.some((motif) => motif.test(f)));

				// Version dérivée du contenu : un déploiement sans changement réel
				// n'invalide pas le cache des visiteurs.
				const empreinte = createHash('sha256');
				for (const fichier of [...retenus].sort()) {
					empreinte.update(fichier);
					empreinte.update(await readFile(path.join(racine, fichier)));
				}
				const version = empreinte.digest('hex').slice(0, 8);

				const precache = [...new Set(retenus.map((f) => versUrl(f, portee)))].sort();

				await writeFile(path.join(racine, 'sw.js'), rendre({ version, portee, precache }), 'utf8');
				logger.info(`sw.js — ${precache.length} entrées précachées (version ${version})`);
			},
		},
	};
}

function rendre({ version, portee, precache }) {
	return `// Généré par integrations/service-worker.mjs — ne pas éditer.
const CACHE = 'devbook-${version}';
const PORTEE = ${JSON.stringify(portee)};
const PRECACHE = ${JSON.stringify(precache, null, '\t')};

self.addEventListener('install', (evenement) => {
	evenement.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE);
			// \`addAll\` est atomique : une seule 404 ferait échouer toute l'installation.
			const resultats = await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
			const echecs = resultats.filter((r) => r.status === 'rejected').length;
			if (echecs) console.warn(\`[sw] \${echecs}/\${PRECACHE.length} entrées non mises en cache\`);
			await self.skipWaiting();
		})(),
	);
});

self.addEventListener('activate', (evenement) => {
	evenement.waitUntil(
		(async () => {
			for (const nom of await caches.keys()) {
				if (nom !== CACHE && nom.startsWith('devbook-')) await caches.delete(nom);
			}
			await self.clients.claim();
		})(),
	);
});

self.addEventListener('fetch', (evenement) => {
	const requete = evenement.request;
	if (requete.method !== 'GET') return;

	const cible = new URL(requete.url);
	if (cible.origin !== self.location.origin || !cible.pathname.startsWith(PORTEE)) return;

	// Navigation : le réseau d'abord, pour ne pas servir une fiche périmée.
	if (requete.mode === 'navigate') {
		evenement.respondWith(
			(async () => {
				try {
					const reponse = await fetch(requete);
					const cache = await caches.open(CACHE);
					evenement.waitUntil(cache.put(requete, reponse.clone()));
					return reponse;
				} catch {
					const cache = await caches.open(CACHE);
					const avecSlash = cible.pathname.endsWith('/') ? cible.pathname : \`\${cible.pathname}/\`;
					return (
						(await cache.match(requete)) ??
						(await cache.match(avecSlash)) ??
						(await cache.match(PORTEE)) ??
						Response.error()
					);
				}
			})(),
		);
		return;
	}

	// Ressources : le cache d'abord. Les noms de \`_astro/\` portent un hash, et
	// l'index Pagefind est réécrit à chaque build, donc rien n'y est périmé.
	evenement.respondWith(
		(async () => {
			const cache = await caches.open(CACHE);
			const enCache = await cache.match(requete);
			if (enCache) return enCache;

			const reponse = await fetch(requete);
			if (reponse.ok && reponse.type === 'basic') {
				evenement.waitUntil(cache.put(requete, reponse.clone()));
			}
			return reponse;
		})(),
	);
});
`;
}
