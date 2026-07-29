/* ═══════════════════════════════════════════════════════
   13 · DASHBOARD — KPIs et répartitions
   ═══════════════════════════════════════════════════════ */

import { S, typeById } from './state.js';
import { EL, esc } from './dom.js';
import { STATUSES } from './config.js';
import { scoreBadge } from './score.js';

/* ─── Correspondance logique → id réel du HTML ───
   Ajuste la valeur de droite si ton markup diffère.        */
const SLOT = {
  kpis    : 'dash-kpis',
  byType  : 'dash-by-type',
  byStatus: 'dash-by-status',
  byRegion: 'dash-by-region',
  top     : 'dash-top'
};

const today = () => new Date().toISOString().slice(0, 10);
let openCb = () => {};

/** Écrit dans un conteneur s'il existe ; sinon prévient une seule fois. */
const warned = new Set();
function fill(slot, html){
  const el = EL[SLOT[slot]];
  if (el){ el.innerHTML = html; return true; }
  if (!warned.has(slot)){
    warned.add(slot);
    console.warn(`[dash] "${SLOT[slot]}" absent du DOM → bloc "${slot}" ignoré`);
  }
  return false;
}

export function initDash(onOpen){
  openCb = onOpen || openCb;
  EL[SLOT.top]?.addEventListener('click', (e) => {
    const row = e.target.closest('[data-id]');
    if (row) openCb(row.dataset.id);
  });
}

function kpi(label, value, hint = ''){
  return `<div class="kpi">
    <div class="kpi-val">${esc(String(value))}</div>
    <div class="kpi-lbl">${esc(label)}</div>
    ${hint ? `<div class="kpi-hint">${esc(hint)}</div>` : ''}
  </div>`;
}

function bars(title, entries){
  if (!entries.length) return `<h3>${esc(title)}</h3>
    <p class="muted">Aucune donnée.</p>`;
  const max = Math.max(...entries.map(e => e.n), 1);
  return `<h3>${esc(title)}</h3>
    <div class="bars">${entries.map(e => `
      <div class="bar-row">
        <span class="bar-lbl">${e.html || esc(e.label)}</span>
        <span class="bar-track">
          <span class="bar-fill" style="width:${(e.n/max*100).toFixed(1)}%;
            ${e.color ? `background:${e.color}` : ''}"></span>
        </span>
        <span class="bar-n">${e.n}</span>
      </div>`).join('')}</div>`;
}

export function render(){
  const src = Array.isArray(S.view) ? S.view : [];
  const n = src.length;

  /* ─── KPIs ─── */
  const scored = src.filter(p => Number.isFinite(p.score));
  const avg = scored.length
    ? Math.round(scored.reduce((s,p) => s + p.score, 0) / scored.length)
    : '—';
  const partners = src.filter(p => p.status === 'partenaire').length;
  const late  = src.filter(p => p.next_date && p.next_date <= today()).length;
  const noGeo = src.filter(p => !Number.isFinite(p.lat)).length;
  const favs  = src.filter(p => p.favorite).length;

  fill('kpis', [
    kpi('Lieux affichés', n, `sur ${S.places.length} au total`),
    kpi('Score moyen', avg, `${scored.length} lieu(x) noté(s)`),
    kpi('Partenaires', partners, n ? `${Math.round(partners/n*100)} %` : ''),
    kpi('Relances dues', late, late ? 'à traiter' : 'rien d\'urgent'),
    kpi('Favoris', favs),
    kpi('Sans coordonnées', noGeo,
        noGeo ? 'invisibles sur la carte' : 'tout est géolocalisé')
  ].join(''));

  /* ─── Par type ─── */
  const byType = new Map();
  for (const p of src){
    const k = p.type_id || '_none';
    byType.set(k, (byType.get(k) || 0) + 1);
  }
  fill('byType', bars('Par type',
    [...byType.entries()].map(([id, cnt]) => {
      const t = typeById(id);
      return {
        html : t ? `${t.emoji} ${esc(t.label)}` : '📍 Non typé',
        color: t?.color,
        n    : cnt
      };
    }).sort((a,b) => b.n - a.n)));

  /* ─── Par statut ─── */
  fill('byStatus', bars('Par statut',
    STATUSES.map(s => ({
      label: s.l,
      n    : src.filter(p => p.status === s.v).length
    })).filter(e => e.n > 0)));

  /* ─── Par région ─── */
  const byReg = new Map();
  for (const p of src){
    const k = p.region || '—';
    byReg.set(k, (byReg.get(k) || 0) + 1);
  }
  fill('byRegion', bars('Par région',
    [...byReg.entries()]
      .map(([label, cnt]) => ({ label, n: cnt }))
      .sort((a,b) => b.n - a.n)
      .slice(0, 12)));

  /* ─── Top 10 ─── */
  const top = [...scored].sort((a,b) => b.score - a.score).slice(0, 10);
  fill('top', `<h3>Meilleurs scores</h3>` + (
    top.length
      ? `<div class="top-list">${top.map((p,i) => {
          const t = typeById(p.type_id);
          return `<div class="top-row" data-id="${esc(String(p.id))}">
            <span class="top-rank">${i+1}</span>
            <span class="top-name">${t?.emoji || '📍'} ${esc(p.name || '(sans nom)')}</span>
            <span class="muted">${esc(p.city || '')}</span>
            <span class="badge ${scoreBadge(p.score)}">${p.score}</span>
          </div>`;
        }).join('')}</div>`
      : `<p class="muted">Aucun lieu noté pour le moment.</p>`
  ));
}
