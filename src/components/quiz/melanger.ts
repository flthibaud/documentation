/**
 * Mélange en place les enfants de `parent` qui matchent `selecteur`, sans toucher
 * aux autres nœuds : les éléments mélangés sont réinsérés là où se trouvait le
 * dernier d'entre eux.
 *
 * Passer un sélecteur `:scope > …` — sinon un `<Quiz>` imbriqué serait aspiré.
 */
export function melangerEnfants(parent: Element, selecteur: string): void {
	const noeuds = Array.from(parent.querySelectorAll(selecteur));
	if (noeuds.length < 2) return;

	// Repère pris avant le mélange : réinsérer en boucle devant lui reconstitue
	// la séquence à sa place d'origine. `null` = fin du parent, ce qui convient.
	const repere = noeuds[noeuds.length - 1]!.nextSibling;

	for (let i = noeuds.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		const permute = noeuds[i]!;
		noeuds[i] = noeuds[j]!;
		noeuds[j] = permute;
	}

	for (const noeud of noeuds) parent.insertBefore(noeud, repere);
}
