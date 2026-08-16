// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

/**
 * Publication sur GitHub Pages (site de projet).
 * URL finale : https://flthibaud.github.io/documentation
 *
 * Si tu branches un domaine perso plus tard : mets `site` sur ce domaine
 * et remplace `base` par '/'.
 */
const REPO = 'flthibaud/documentation';
const SITE = 'https://flthibaud.github.io';
const BASE = '/documentation';

export default defineConfig({
	site: SITE,
	base: BASE,
	integrations: [
		starlight({
			title: 'Base de connaissance',
			description:
				'Notes techniques, structures de données et cours de l’IUT — la mémoire externe de Florian.',
			// Interface en français, sans préfixe de langue dans les URLs.
			defaultLocale: 'root',
			locales: {
				root: { label: 'Français', lang: 'fr' },
			},
			social: [{ icon: 'github', label: 'GitHub', href: `https://github.com/${REPO}` }],
			editLink: {
				baseUrl: `https://github.com/${REPO}/edit/main/`,
			},
			// Date de dernière modification déduite de l'historique Git.
			lastUpdated: true,
			pagination: true,
			tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 4 },
			customCss: ['./src/styles/custom.css'],
			components: {
				// Affiche les tags et le statut de la page sous le titre.
				PageTitle: './src/components/PageTitle.astro',
				// Affiche les sources du frontmatter au-dessus du pied de page.
				Footer: './src/components/Footer.astro',
			},
			sidebar: [
				{
					label: 'Démarrer',
					items: [
						{ slug: 'meta/comment-utiliser' },
						{ slug: 'meta/conventions' },
						{ slug: 'meta/modeles' },
						{ slug: 'meta/publication' },
					],
				},
				{
					// Dossier `technique/` et non `documentation/` : le site est déjà servi
					// sous /documentation, ça donnerait une URL /documentation/documentation/.
					label: 'Documentation technique',
					badge: { text: 'Dev', variant: 'note' },
					items: [{ autogenerate: { directory: 'technique' } }],
				},
				{
					label: 'Structures de données',
					badge: { text: 'Algo', variant: 'tip' },
					items: [{ autogenerate: { directory: 'structures-de-donnees' } }],
				},
				{
					label: 'IUT',
					badge: { text: 'Cours', variant: 'caution' },
					collapsed: true,
					items: [{ autogenerate: { directory: 'iut', collapsed: true } }],
				},
				{
					label: 'Transversal',
					items: [{ label: 'Parcourir par tag', link: '/tags/' }],
				},
			],
		}),
	],
});
