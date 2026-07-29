/* ═══════════════════════════════════════════════════════
   9 · FILTRES — filtrage + tri, produit S.view
   ═══════════════════════════════════════════════════════ */

import { S } from './state.js';
import { EL, getVal, setTxt, on } from './dom.js';

const today = () => new Date().toISOString().slice(0, 10);

/* ─── Presets ─── */
function matchPreset(p){
  switch (S.preset){
    case 'fav':  return !!p.favorite;
    case 'todo': return p.status === 'a_contacter';
    case 'hot':  return p.relation === 'chaude' || p.relation === 'etablie';
    case 'top':  return (p.score ?? 0) >= 70;
    case 'late': return !!p.next_date && p.next_date <= today();
    default:     return true;
  }
}

/* ─── Recherche plein texte ─── */
function matchQuery(p, q){
  if (!q) return true;
  const hay = [
    p.name, p.city, p.region, p.address, p.postcode,
    p.contact_name, p.email, p.notes, p.next_step,
    ...(p.tags || [])
  ].filter(Boolean).join(' ').toLowerCase();
  return q.split(/\s+/).every(w => hay.includes(w));
}

/* ─── Filtres détaillés ─── */
function matchFilters(p){
  const f = S.f;
  if (f.type     && p.type_id  !== f.type)     return false;
  if (f.status   && p.status   !== f.status)   return false;
  if (f.relation && p.relation !== f.relation) return false;
  if (f.prio     && String(p.priority) !== f.prio) return false;

  const sc = p.score ?? 0;
  if (sc < f.scoreMin || sc > f.scoreMax) return false;

  if (f.region && !(p.region || '').toLowerCase().includes(f.region)) return false;
  if (f.city   && !(p.city   || '').toLowerCase().includes(f.city))   return false;

  if (f.tags){
    const want = f.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    const has  = (p.tags || []).map(t => t.toLowerCase());
    if (!want.every(t => has.includes(t))) return false;
  }

  if (f.fav  && !p.favorite) return false;
  if (f.late && !(p.next_date && p.next_date <= today())) return false;

  return true;
}

/* ─── Tri ─── */
const CMP = {
  score_desc: (a,b) => (b.score ?? -1) - (a.score ?? -1),
  score_asc : (a,b) => (a.score ??  999) - (b.score ??  999),
  name_asc  : (a,b) => (a.name||'').localeCompare(b.name||'', 'fr'),
  name_desc : (a,b) => (b.name||'').localeCompare(a.name||'', 'fr'),
  recent    : (a,b) => String(b.updated_at||'').localeCompare(String(a.updated_at||'')),
  prio_desc : (a,b) => (b.priority ?? 0) - (a.priority ?? 0)
};

/** Recalcule S.view depuis S.places */
export function apply(){
  const q = S.f.q.trim().toLowerCase();
  S.view = S.places
    .filter(p => matchPreset(p) && matchQuery(p, q) && matchFilters(p))
    .sort(CMP[S.sort] || CMP.score_desc);

  setTxt('side-count', `${S.view.length} / ${S.places.length}`);
  return S.view;
}

/* ─── Lecture des champs du DOM vers S.f ─── */
export function readFilters(){
  S.f.q        = getVal('side-search');
  S.f.type     = getVal('f-type');
  S.f.status   = getVal('f-status');
  S.f.relation = getVal('f-relation');
  S.f.prio     = getVal('f-prio');
  S.f.scoreMin = Number(getVal('f-score-min')) || 0;
  S.f.scoreMax = Number(getVal('f-score-max')) || 100;
  S.f.region   = getVal('f-region').trim().toLowerCase();
  S.f.city     = getVal('f-city').trim().toLowerCase();
  S.f.tags     = getVal('f-tags').trim();
  S.f.fav      = EL['f-fav']?.checked  || false;
  S.f.late     = EL['f-late']?.checked || false;
}

export function resetFilters(){
  for (const id of ['f-type','f-status','f-relation','f-prio',
                    'f-region','f-city','f-tags']){
    if (EL[id]) EL[id].value = '';
  }
  if (EL['f-score-min']) EL['f-score-min'].value = 0;
  if (EL['f-score-max']) EL['f-score-max'].value = 100;
  if (EL['f-fav'])  EL['f-fav'].checked  = false;
  if (EL['f-late']) EL['f-late'].checked = false;
  readFilters();
}

/** Branche les écouteurs. onChange = callback de re-rendu. */
export function initFilters(onChange){
  const run = () => { readFilters(); onChange(); };

  let timer;
  on('side-search', 'input', () => {
    clearTimeout(timer);
    timer = setTimeout(run, 180);
  });

  on('side-btn-clear', 'click', () => {
    if (EL['side-search']) EL['side-search'].value = '';
    run();
  });

  for (const id of ['f-type','f-status','f-relation','f-prio',
                    'f-score-min','f-score-max','f-fav','f-late']){
    on(id, 'change', run);
  }
  for (const id of ['f-region','f-city','f-tags']){
    on(id, 'input', () => { clearTimeout(timer); timer = setTimeout(run, 200); });
  }

  on('f-reset', 'click', () => { resetFilters(); onChange(); });

  on('side-sort', 'change', () => {
    S.sort = getVal('side-sort');
    onChange();
  });

  on('side-btn-filters', 'click', () => {
    const box = EL['side-filters'];
    if (box) box.hidden = !box.hidden;
  });

  on('side-presets', 'click', (e) => {
    const btn = e.target.closest('[data-preset]');
    if (!btn) return;
    S.preset = btn.dataset.preset;
    EL['side-presets'].querySelectorAll('[data-preset]')
      .forEach(b => b.classList.toggle('is-on', b === btn));
    onChange();
  });
}
