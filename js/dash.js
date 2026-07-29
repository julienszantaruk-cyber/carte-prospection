/* ═══════════════════════════════════════════════════════
   13 · DASHBOARD — KPIs et répartitions
   ═══════════════════════════════════════════════════════ */

import { S, typeById } from './state.js';
import { EL, esc, setTxt } from './dom.js';
import { STATUSES, PRIORITIES } from './config.js';
import { scoreBadge } from './score.js';

let openCb = () => {};

export function initDash(onOpen){
  openCb = onOpen || openCb;
  EL['ui-top5']?.addEventListener('click', (e) => {
    const row = e.target.closest('[data-id]');
    if (row) openCb(row.dataset.id);
  });
}

/* ─── Formatage ─── */
const nf = new Intl.NumberFormat('fr-FR');
const fmt = (v, unit = '') =>
  Number.isFinite(v) ? nf.format(Math.round(v)) + unit : '—';

function median(arr){
  if (!arr.length) return null;
  const s = [...arr].sort((a,b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m-1] + s[m]) / 2;
}

/* ─── Barres de répartition ─── */
function bars(entries){
  const rows = entries.filter(e => e.n > 0);
  if (!rows.length) return `<p class="muted">Aucune donnée.</p>`;
  const max = Math.max(...rows.map(e => e.n));
  return rows.map(e => `
    <div class="bar-row">
      <span class="bar-lbl">${e.html || esc(e.label)}</span>
      <span class="bar-track">
        <span class="bar-fill" style="width:${(e.n / max * 100).toFixed(1)}%${
          e.color ? `;background:${esc(e.color)}` : ''
        }"></span>
      </span>
      <span class="bar-n">${e.n}</span>
    </div>`).join('');
}

/* ─── Rendu ─── */
export function render(){
  const src = S.view;
  const n = src.length;

  /* ── KPIs ── */
  const scores = src.map(p => p.score).filter(Number.isFinite);
  const avg = scores.length
    ? Math.round(scores.reduce((s,v) => s + v, 0) / scores.length)
    : null;

  const surfaces = src.map(p => +p.surface_total).filter(Number.isFinite);
  const totalSurface = surfaces.reduce((s,v) => s + v, 0);

  const rents = src.map(p => +p.rent_month).filter(v => Number.isFinite(v) && v > 0);
  const medRent = median(rents);

  setTxt('ui-kpi-count',   `${n} / ${S.places.length}`);
  setTxt('ui-kpi-score',   avg === null ? '—' : `${avg}`);
  setTxt('ui-kpi-surface', surfaces.length ? fmt(totalSurface, ' m²') : '—');
  setTxt('ui-kpi-rent',    medRent === null ? '—' : fmt(medRent, ' €'));
  setTxt('ui-kpi-fav',     String(src.filter(p => p.favorite).length));

  /* ── Par type ── */
  const byType = new Map();
  for (const p of src){
    const k = p.type_id || '_none';
    byType.set(k, (byType.get(k) || 0) + 1);
  }
  if (EL['ui-dist-type']){
    EL['ui-dist-type'].innerHTML = bars(
      [...byType.entries()].map(([id, cnt]) => {
        const t = typeById(id);
        return {
          html : t ? `${t.emoji} ${esc(t.label)}` : '📍 Non typé',
          color: t?.color,
          n    : cnt
        };
      }).sort((a,b) => b.n - a.n)
    );
  }

  /* ── Par statut ── */
  if (EL['ui-dist-status']){
    EL['ui-dist-status'].innerHTML = bars(
      STATUSES.map(s => ({
        label: s.l ?? s.label ?? s.v,
        n    : src.filter(p => p.status === (s.v ?? s.value)).length
      }))
    );
  }

  /* ── Par priorité ── */
  if (EL['ui-dist-priority']){
    const list = (typeof PRIORITIES !== 'undefined' && PRIORITIES?.length)
      ? PRIORITIES.map(p => ({ v: p.v ?? p.value, l: p.l ?? p.label ?? p.v }))
      : [...new Set(src.map(p => p.priority).filter(Boolean))]
          .map(v => ({ v, l: v }));

    EL['ui-dist-priority'].innerHTML = bars(
      list.map(p => ({
        label: p.l,
        n    : src.filter(x => x.priority === p.v).length
      }))
    );
  }

  /* ── Top 5 ── */
  if (EL['ui-top5']){
    const top = src
      .filter(p => Number.isFinite(p.score))
      .sort((a,b) => b.score - a.score)
      .slice(0, 5);

    EL['ui-top5'].innerHTML = top.length
      ? top.map((p,i) => {
          const t = typeById(p.type_id);
          return `<div class="top-row" data-id="${esc(String(p.id))}">
            <span class="top-rank">${i+1}</span>
            <span class="top-name">${t?.emoji || '📍'} ${esc(p.name || '(sans nom)')}</span>
            <span class="muted">${esc(p.city || '')}</span>
            <span class="badge ${scoreBadge(p.score)}">${p.score}</span>
          </div>`;
        }).join('')
      : `<p class="muted">Aucun lieu noté.</p>`;
  }
}
