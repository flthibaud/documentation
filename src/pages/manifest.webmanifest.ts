import type { APIRoute } from 'astro';
import { url } from '../lib/url';

/**
 * Manifeste servi en endpoint et non en fichier statique : `start_url`, `scope`
 * et les chemins d'icônes doivent porter le `base` du site, qui vaut
 * /documentation sur GitHub Pages. Un renommage du dépôt les suit tout seul.
 */
export const GET: APIRoute = () => {
	const manifeste = {
		id: url('/'),
		name: 'DevBook — Base de connaissance',
		short_name: 'DevBook',
		description:
			'Notes techniques, structures de données et cours de l’IUT, consultables hors ligne.',
		lang: 'fr',
		dir: 'ltr',
		start_url: url('/'),
		scope: url('/'),
		display: 'standalone',
		// Fond de l'écran de démarrage : --sl-color-black du thème sombre, qui est
		// le thème par défaut du site.
		background_color: '#17181c',
		theme_color: '#3447d4',
		categories: ['education', 'productivity', 'books'],
		icons: [
			{ src: url('/icons/icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
			{ src: url('/icons/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
			{
				src: url('/icons/icon-maskable-512.png'),
				sizes: '512x512',
				type: 'image/png',
				purpose: 'maskable',
			},
		],
		// Appui long sur l'icône, sur Android.
		shortcuts: [
			{ name: 'Structures de données', url: url('/structures-de-donnees/') },
			{ name: 'Documentation technique', url: url('/technique/') },
			{ name: 'Parcourir par tag', url: url('/tags/') },
		],
	};

	return new Response(JSON.stringify(manifeste, null, '\t'), {
		headers: { 'Content-Type': 'application/manifest+json; charset=utf-8' },
	});
};
