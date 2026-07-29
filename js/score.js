/* ═══════════════════════════════════════════════════════
   6 · SCORE — moyenne pondérée des notations → 0..100
   ═══════════════════════════════════════════════════════ */

import { STARS_MAX } from './config.js';

/**
 * ratings : { criteriaKey: 1..STARS_MAX }
 * crit    : [{ key, weight, ... }] (poids numeric, décimales OK)
 * Retour  : 0..100 arrondi, ou null si aucune note exploitable.
 *
 * Seuls les critères notés comptent : noter 2 critères sur 6
 * ne pénalise pas le score, ça le rend juste moins fiable.
 */
export function computeScore(ratings, crit){
  if (!ratings || typeof ratings !== 'object') return null;
  if (!Array.isArray(crit) || crit.length === 0) return null;

  let sum = 0, wsum = 0;

  for (const c of crit){
    const n = Number(ratings[c.key]);
    if (!Number.isFinite(n) || n <= 0) continue;
    const w = Number(c.weight);
    const weight = Number.isFinite(w) && w > 0 ? w : 1;
    sum  += (n / STARS_MAX) * weight;
    wsum += weight;
  }

  if (wsum === 0) return null;
  return Math.round((sum / wsum) * 100);
}

/** Nombre de critères notés / total — pour afficher la fiabilité */
export function coverage(ratings, crit){
  if (!Array.isArray(crit) || crit.length === 0) return { done:0, total:0 };
  const done = crit.filter(c => Number(ratings?.[c.key]) > 0).length;
  return { done, total: crit.length };
}

/**
 * Badge de score prêt à insérer (HTML sûr : interpolation d'entiers uniquement).
 * @param {number|null|undefined} score  0–100, ou nullish si non évalué
 * @param {{cov?: number}} [opts]  cov : couverture 0–1 issue de coverage()
 */
export function scoreBadge(score, { cov } = {}) {
  const n = Number(score);
  if (!Number.isFinite(n)) {
    return '<span class="badge badge--none" title="Non évalué">—</span>';
  }
  const v = Math.max(0, Math.min(100, Math.round(n)));
  const tier = v >= 80 ? 'high' : v >= 50 ? 'mid' : 'low';

  const c = Number(cov);
  const partial = Number.isFinite(c) && c < 1;
  const pct = partial ? Math.round(c * 100) : 100;
  const title = partial
    ? `Score : ${v}/100 — évaluation partielle (${pct} % des critères)`
    : `Score : ${v}/100`;

  return `<span class="badge badge--${tier}${partial ? ' badge--partial' : ''}" title="${title}">${v}${partial ? '<sup>*</sup>' : ''}</span>`;
}
