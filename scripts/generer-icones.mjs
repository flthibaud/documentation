/**
 * Génère les icônes PWA depuis public/favicon.svg.
 *
 *   node scripts/generer-icones.mjs
 *
 * Le favicon porte son remplissage dans un <style> avec un
 * `prefers-color-scheme` : sharp rastérise sans média queries et sortirait un
 * glyphe noir. On retire donc ce bloc et on impose `fill` sur le groupe.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const RACINE = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const SOURCE = path.join(RACINE, 'public', 'favicon.svg');
const SORTIE = path.join(RACINE, 'public', 'icons');

const FOND = '#3447d4'; // --sl-color-accent du thème sombre
const GLYPHE = '#ffffff';

/** viewBox du favicon. */
const COTE = 128;

/**
 * `echelle` = part du canvas occupée par le glyphe.
 * Pour une icône maskable, le système peut rogner jusqu'au cercle central de
 * 80 % : on reste bien en deçà.
 */
const CIBLES = [
	{ fichier: 'icon-192.png', taille: 192, echelle: 0.72 },
	{ fichier: 'icon-512.png', taille: 512, echelle: 0.72 },
	{ fichier: 'icon-maskable-512.png', taille: 512, echelle: 0.56 },
	{ fichier: 'apple-touch-icon.png', taille: 180, echelle: 0.66 },
];

const brut = await readFile(SOURCE, 'utf8');

const corps = brut
	.replace(/<style>[\s\S]*?<\/style>/g, '')
	.replace(/^[\s\S]*?<svg[^>]*>/, '')
	.replace(/<\/svg>\s*$/, '')
	.trim();

if (!corps.includes('<path')) {
	throw new Error(`Aucun <path> extrait de ${SOURCE} — le favicon a changé de structure.`);
}

function composer(echelle) {
	const centre = COTE / 2;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COTE} ${COTE}">
	<rect width="${COTE}" height="${COTE}" fill="${FOND}"/>
	<g fill="${GLYPHE}" transform="translate(${centre} ${centre}) scale(${echelle}) translate(-${centre} -${centre})">
		${corps}
	</g>
</svg>`;
}

await mkdir(SORTIE, { recursive: true });

for (const { fichier, taille, echelle } of CIBLES) {
	const destination = path.join(SORTIE, fichier);
	await sharp(Buffer.from(composer(echelle)), { density: 384 })
		.resize(taille, taille)
		.png({ compressionLevel: 9 })
		.toFile(destination);
	console.log(`  ${path.relative(RACINE, destination)}  ${taille}×${taille}`);
}

// Version vectorielle, servie aux navigateurs qui la préfèrent.
await writeFile(path.join(SORTIE, 'icon.svg'), composer(0.72), 'utf8');
console.log('  public/icons/icon.svg  vectoriel');
