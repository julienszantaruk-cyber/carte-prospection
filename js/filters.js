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

  /* Champs "identité juridique / modèle" */
  if (f.legalForm     && p.legal_form     !== f.legalForm)     return false;
  if (f.governance    && p.governance     !== f.governance)    return false;
  if (f.businessModel && p.business_model !== f.businessModel) return false;

  /* Score : seuil minimal unique */
  if (f.scoreMin && (p.score ?? 0) < f.scoreMin) return false;

  /* Surface */
  const surf = p.surface ?? null;
  if (f.surfaceMin !== null && (surf === null || surf < f.surfaceMin)) return false;
  if (f.surfaceMax !== null && (surf === null || surf > f.surfaceMax)) return false;

  if (f.city && !(p.city || '').toLowerCase().includes(f.city)) return false;

  if (f.tags){
    const want = f.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    const has  = (p.tags || []).map(t => t.toLowerCase());
    if (!want.every(t => has.includes(t))) return false;
  }

  if (f.fav && !p.favorite) return false;

  /* Restriction à l'emprise visible de la carte */
  if (f.inView && S.mapBounds){
    if (p.lat === null || p.lng === null) return false;
    const b = S.mapBounds;
    if (p.lat < b.south || p.lat > b.north) return false;
    if (p.lng < b.west  || p.lng > b.east)  return false;
  }

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
  const q = (S.f.q || '').trim().toLowerCase();
  S.view = S.places
    .filter(p => matchPreset(p) && matchQuery(p, q) && matchFilters(p))
    .sort(CMP[S.sort] || CMP.score_desc);

  setTxt('ui-count', `${S.view.length} / ${S.places.length}`);
  return S.view;
}

/* ─── Lecture des champs du DOM vers S.f ─── */
const num = (id, dflt = null) => {
  const v = getVal(id).trim();
  return v === '' ? dflt : Number(v);
};

export function readFilters(){
  S.f.q             = getVal('flt-search');
  S.f.type          = getVal('flt-type');
  S.f.status        = getVal('flt-status');
  S.f.relation      = getVal('flt-relation');
  S.f.prio          = getVal('flt-priority');
  S.f.legalForm     = getVal('flt-legal-form');
  S.f.governance    = getVal('flt-governance');
  S.f.businessModel = getVal('flt-business-model');
  S.f.scoreMin      = num('flt-score', 0) || 0;
  S.f.surfaceMin    = num('flt-surface-min');
  S.f.surfaceMax    = num('flt-surface-max');
  S.f.city          = getVal('flt-city').trim().toLowerCase();
  S.f.tags          = getVal('flt-tags').trim();
  S.f.fav           = EL['flt-fav']?.checked     || false;
  S.f.inView        = EL['flt-in-view']?.checked || false;
}

export function resetFilters(){
  for (const id of ['flt-type','flt-status','flt-relation','flt-priority',
                    'flt-legal-form','flt-governance','flt-business-model',
                    'flt-city','flt-tags','flt-surface-min','flt-surface-max']){
    if (EL[id]) EL[id].value = '';
  }
  if (EL['flt-score'])   EL['flt-score'].value = 0;
  if (EL['flt-fav'])     EL['flt-fav'].checked = false;
  if (EL['flt-in-view']) EL['flt-in-view'].checked = false;
  S.preset = '';
  EL['ui-presets']?.querySelectorAll('[data-preset]')
    .forEach(b => b.classList.remove('is-active'));
  readFilters();
}

/** Branche les écouteurs. onChange = callback de re-rendu. */
export function initFilters(onChange){
  const run = () => { readFilters(); onChange(); };

  let timer;
  const debounced = () => { clearTimeout(timer); timer = setTimeout(run, 180); };

  /* Recherche */
  on('flt-search', 'input', debounced);
  on('btn-flt-clear', 'click', () => {
    if (EL['flt-search']) EL['flt-search'].value = '';
    run();
  });

  /* Selects et cases à cocher */
  for (const id of ['flt-type','flt-status','flt-relation','flt-priority',
                    'flt-legal-form','flt-governance','flt-business-model',
                    'flt-fav','flt-in-view']){
    on(id, 'change', run);
  }

  /* Champs numériques et texte libre */
  for (const id of ['flt-city','flt-tags','flt-surface-min','flt-surface-max']){
    on(id, 'input', debounced);
  }

  /* Score : input pour le retour visuel immédiat du curseur */
  on('flt-score', 'input', () => {
    setTxt('ui-score-val', getVal('flt-score'));
    debounced();
  });

  /* Réinitialisation */
  on('btn-flt-reset', 'click', () => { resetFilters(); onChange(); });

  /* Tri */
  on('flt-sort', 'change', () => {
    S.sort = getVal('flt-sort');
    onChange();
  });

  /* Repli du panneau */
  on('btn-flt-toggle', 'click', () => {
    const box = EL['ui-filters'];
    if (box) box.hidden = !box.hidden;
  });

  /* Presets */
  EL['ui-presets']?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-preset]');
    if (!btn) return;
    const val = btn.dataset.preset;
    S.preset = (S.preset === val) ? '' : val;   // re-clic = désactive
    EL['ui-presets'].querySelectorAll('[data-preset]')
      .forEach(b => b.classList.toggle('is-active', b.dataset.preset === S.preset));
    onChange();
  });
}
