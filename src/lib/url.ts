const base = import.meta.env.BASE_URL.replace(/\/$/, '');

/**
 * Construit un lien interne en tenant compte du `base` du site.
 * Indispensable sur GitHub Pages où le site est servi sous /documentation.
 *
 * url('/structures-de-donnees/') -> '/documentation/structures-de-donnees/'
 */
export function url(path = '/'): string {
	return `${base}/${path.replace(/^\//, '')}`;
}

/** Slug utilisé dans les URLs de tags (accents et espaces retirés). */
export function tagSlug(tag: string): string {
	return tag
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}
