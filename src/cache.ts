/**
 * Regle de fraicheur commune aux caches courts qui protegent un calcul cher
 * (scan des worktrees, etat git derive).
 *
 * Un cache reste valable au moins aussi longtemps que ce qu'a coute son calcul.
 * Sans cette borne, un calcul plus lent que son TTL produit un cache deja perime
 * a la seconde ou il est ecrit : chaque requete suivante relance un scan complet,
 * chaque scan ralentit la machine, et le serveur ne redescend jamais. C'est
 * l'emballement observe deux fois le 2026-08-07 — node a ~440 % CPU, charge
 * machine au-dessus de 8, plus aucune reponse HTTP.
 *
 * Le facteur 2 laisse toujours au moins autant de repit que de travail : quoi
 * qu'il arrive, le serveur passe au plus la moitie de son temps a recalculer.
 */
export function freshnessWindowMs(durationMs: number, baseTtlMs: number): number {
  return Math.max(baseTtlMs, durationMs * 2)
}

/**
 * Un cache doit porter l'instant de **fin** du calcul, jamais celui du debut :
 * horodater le debut ampute la fenetre de fraicheur de la duree du calcul.
 */
export function isFresh(
  entry: { at: number; durationMs: number } | null,
  now: number,
  baseTtlMs: number,
): boolean {
  if (entry === null) {
    return false
  }
  return now - entry.at < freshnessWindowMs(entry.durationMs, baseTtlMs)
}
