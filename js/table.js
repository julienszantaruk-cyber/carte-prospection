/* ═══════════════════════════════════════════════════════
   12 · TABLEAU — colonnes configurables
   ═══════════════════════════════════════════════════════ */

import { S, typeById } from './state.js';
import { EL, esc } from './dom.js';
import { COLS, STATUSES, RELATIONS } from './config.js';
import { scoreBadge } from './score.js';

const label = (arr, v) => arr.find(x => x.v === v)?.l || '—';
let openCb = () => {};

export function initTable(onOpen){
  openCb = onOpen || openCb;
  EL['ui-table-body']?.addEventListener('click', (e) => {
    const tr = e.target.closest('[data-id]');
    if (tr) openCb(tr.dataset.id);
  });
  EL['ui-table-head']?.addEventListener('click', (e) => {
    const th = e.target.closest('[data-sort]');
    if (!th) return;
    const k = th.dataset.sort;
    S.sort = S.sort === k + '_asc' ? k + '_desc' : k + '_asc';
    if (EL['flt-sort']) EL['flt-sort'].value = S.sort;
    window.dispatchEvent(new CustomEvent('app:rerender'));
  });
}

function cell(p, k){
  const t = typeById(p.type_id);
  switch (k){
    case 'name':     return `<b>${esc(p.name)}</b>${p.favorite ? ' <span class="item-fav">★</span>' : ''}`;
    case 'type':     return t ? esc(t.emoji + ' ' + t.label) : '—';
    case 'status':   { const s = STATUSES.find(x => x.v === p.status) || STATUSES[0];
                       return `<span class="badge ${s.badge}">${s.l}</span>`; }
    case 'relation': return label(RELATIONS, p.relation);
    case 'score':    return p.score == null ? '—'
                       : `<span class="badge ${scoreBadge(p.score)}">${p.score}</span>`;
    case 'priority': return p.priority ? 'P' + p.priority : '—';
    case 'capacity': return p.capacity ?? '—';
    case 'contact':  return esc(p.contact_name || '—');
    case 'email':    return p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : '—';
    case 'phone':    return esc(p.phone || '—');
    case 'website':  return p.website ? `<a href="${esc(p.website)}" target="_blank" rel="noopener">↗</a>` : '—';
    case 'tags':     return (p.tags || []).map(t => `<span class="chip">${esc(t)}</span>`).join(' ') || '—';
    case 'updated_at': return esc(String(p.updated_at || '').slice(0, 10));
    default:         return esc(p[k] ?? '—');
  }
}

export function render(){
  const head = EL['ui-table-head'], body = EL['ui-table-body'];
  if (!head || !body) return;

  const cols = COLS.filter(c => S.cols.includes(c.k));

  head.innerHTML = '<tr>' + cols.map(c =>
    `<th data-sort="${c.k}">${esc(c.l)}</th>`
  ).join('') + '</tr>';

  if (!S.view.length){
    body.innerHTML = `<tr><td colspan="${cols.length}" class="empty-cell">
      Aucun lieu ne correspond aux filtres.</td></tr>`;
    return;
  }

  body.innerHTML = S.view.map(p =>
    `<tr data-id="${p.id}"${p.id === S.selId ? ' class="is-sel"' : ''}>` +
    cols.map(c => `<td>${cell(p, c.k)}</td>`).join('') +
    '</tr>'
  ).join('');
}
