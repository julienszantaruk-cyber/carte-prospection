/* ═══════════════════════════════════════════════════════
   11 · LISTE — panneau latéral
   ═══════════════════════════════════════════════════════ */

import { S, typeById } from './state.js';
import { EL, esc } from './dom.js';
import { STATUSES } from './config.js';
import { scoreBadge } from './score.js';

const statusOf = v => STATUSES.find(s => s.v === v) || STATUSES[0];
let openCb = () => {};

export function initList(onOpen){
  openCb = onOpen || openCb;
  EL['side-list']?.addEventListener('click', (e) => {
    const row = e.target.closest('[data-id]');
    if (row) openCb(row.dataset.id);
  });
}

export function render(){
  const box = EL['side-list'];
  if (!box) return;

  if (!S.view.length){
    box.innerHTML = `<div class="empty">
      <div class="empty-ico">🗺️</div>
      <p>Aucun lieu ne correspond.</p>
      <p class="muted">Ajuste les filtres ou crée un lieu.</p>
    </div>`;
    return;
  }

  box.innerHTML = S.view.map(p => {
    const t  = typeById(p.type_id);
    const st = statusOf(p.status);
    const sc = p.score;
    return `
    <article class="item${p.id === S.selId ? ' is-sel' : ''}" data-id="${p.id}">
      <div class="item-top">
        <span class="item-emoji">${t?.emoji || '📍'}</span>
        <h4 class="item-name">${esc(p.name)}</h4>
        ${p.favorite ? '<span class="item-fav">★</span>' : ''}
      </div>
      <div class="item-mid">
        <span class="badge ${st.badge}">${st.l}</span>
        ${sc !== null && sc !== undefined
          ? `<span class="badge ${scoreBadge(sc)}">${sc}</span>` : ''}
        ${p.priority >= 3 ? `<span class="badge badge-warn">P${p.priority}</span>` : ''}
      </div>
      <div class="item-bot muted">
        ${esc([p.city, p.region].filter(Boolean).join(' · ')) || '—'}
        ${p.next_date ? ` · ⏰ ${esc(p.next_date)}` : ''}
      </div>
    </article>`;
  }).join('');
}
