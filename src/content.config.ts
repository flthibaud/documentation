import { defineCollection } from 'astro:content';
// `z` depuis 'astro:content' est déprécié en Astro 7 ; c'est aussi l'instance
// qu'utilise le schéma Starlight en interne.
import { z } from 'astro/zod';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: z.object({
				/** Mots-clés transversaux, utilisés par les pages /tags/. */
				tags: z.array(z.string()).default([]),
				/** État de la fiche : utile pour repérer ce qui reste à finir. */
				statut: z.enum(['brouillon', 'en-cours', 'stable']).default('stable'),
				/** Sources externes consultées pour écrire la fiche. */
				sources: z
					.array(z.object({ titre: z.string(), url: z.url() }))
					.default([]),
			}),
		}),
	}),
};
