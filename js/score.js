/* ═══════════════════════════════════════════════════════
   6 · SCORE — moyenne pondérée des notations
   ═══════════════════════════════════════════════════════ */

import { STARS_MAX } from './config.js';

/**
 * Calcule le score sur 100.
 * ratings  : { criterionId: 1..5 }
 * criteria : [{ id, weight }]
 * Seuls les critères NOTÉS comptent → un lieu partiellement
 * évalué n'est pas pénalisé.
 * Retourne null si aucune notation.
 */
export function computeScore(ratings, criteria){
  if (!ratings || !criteria?.length) return null;

  let sum = 0, weights = 0;

  for (const c of criteria){
    const r = ratings[c.id];
    if (!r || r <= 0) continue;
    const w = Number(c.weight) || 1;
    sum     += (r / STARS_MAX) * w;
    weights += w;
  }

  if (weights === 0) return null;
  return Math.round((sum / weights) * 100);
}

/** Nombre de critères notés / total */
export function scoreCoverage(ratings, criteria){
  if (!criteria?.length) return { done:0, total:0 };
  const done = criteria.filter(c => (ratings?.[c.id] ?? 0) > 0).length;
  return { done, total: criteria.length };
}

/** Classe CSS de badge selon le score */
export function scoreBadge(score){
  if (score === null || score === undefined) return 'badge-dim';
  if (score >= 75) return 'badge-ok';
  if (score >= 50) return 'badge-acc';
  if (score >= 25) return 'badge-warn';
  return 'badge-danger';
}
