/* ═══════════════════════════════════════════════════════
   9 · FILTRES — filtrage + tri, produit S.view
   ═══════════════════════════════════════════════════════ */

import { S } from './state.js';
import { EL, getVal, setTxt, on } from './dom.js';

const today = () => new Date().toISOString().slice(0, 10);

/* ─── Ids des 4 boutons preset (HTML réel) ─── */
const PRESETS = {
  'btn-preset-recent': 'recent',
  'btn-preset-top'   : 'top',
  'btn-preset-todo'  : 'todo',
  'btn-preset-fav'   : 'fav'
};

function matchPreset(p){
  switch (S.preset){
    case 'fav'   : return !!p.favorite;
    case 'todo'  : return p.status === 'a_contacter'
                       || (!!p.next_date && p.next_date <= today());
    case 'top'   : return (p.score ?? 0) >= 70;
    case 'recent': return true;   // géré par le tri
    default      : return true;
  }
}

/* ─── Recherche plein texte ─── */
function matchQuery(p, q){
  if (!q) return true;
  const hay = [
    p.name, p.city, p.zip, p.address, p.country,
    p.contact_name, p.email, p.takeaway, p.next_action,
    ...(p.tags || [])
  ].filter(Boolean).join(' ').toLowerCase();
  return q.split(/\s+/).every(w => hay.includes(w));
}

/* ─── Multi-sélection : vide = tout accepter ─── */
const anyOf = (arr, v) => !arr.length || arr.includes(String(v));

function matchFilters(p){
  const f = S.f;

  if (!anyOf(f.type,          p.type_id))  return false;
  if (!anyOf(f.status,        p.status))   return false;
  if (!anyOf(f.relation,      p.relation)) return false;
  if (!anyOf(f.prio,          p.priority)) return false;
  if (!anyOf(f.legalForm,     p.legal_form))     return false;
  if (!anyOf(f.governance,    p.governance))     return false;
  if (!anyOf(f.businessModel, p.business_model)) return false;

  if (f.scoreMin && (p.score ?? 0) < f.scoreMin) return false;

  const surf = p.surface_total ?? null;
  if (f.surfaceMin !== null && (surf === null || surf < f.surfaceMin)) return false;
  if (f.surfaceMax !== null && (surf === null || surf > f.surfaceMax)) return false;

  if (f.fav && !p.favorite) return false;

  if (f.inView && S.mapBounds){
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return false;
    const b = S.mapBounds;
    if (p.lat < b.south || p.lat > b.north) return false;
    if (p.lng < b.west  || p.lng > b.east)  return false;
  }

  return true;
}

/* ─── Tri : valeurs = <option> de flt-sort ─── */
const CMP = {
  recent : (a,b) => String(b.updated_at||'').localeCompare(String(a.updated_at||'')),
  score  : (a,b) => (b.score ?? -1) - (a.score ?? -1),
  name   : (a,b) => (a.name||'').localeCompare(b.name||'', 'fr'),
  surface: (a,b) => (b.surface_total ?? -1) - (a.surface_total ?? -1),
  rent   : (a,b) => (a.rent_month ?? Infinity) - (b.rent_month ?? Infinity),
  year   : (a,b) => (b.opened_year ?? -1) - (a.opened_year ?? -1)
};

export function apply(){
  const q = (S.f.q || '').trim().toLowerCase();
  const sortKey = (S.preset === 'top') ? 'score'
                : (S.preset === 'recent') ? 'recent'
                : S.sort;

  S.view = S.places
    .filter(p => matchPreset(p) && matchQuery(p, q) && matchFilters(p))
    .sort(CMP[sortKey] || CMP.recent);

  setTxt('ui-count', `${S.view.length} / ${S.places.length}`);
  updateFilterCount();
  return S.view;
}

/* ─── Lecture du DOM ─── */
const num = (id, dflt = null) => {
  const v = getVal(id).trim();
  return v === '' ? dflt : Number(v);
};

/** Valeurs d'un <select multiple> */
const multi = (id) =>
  [...(EL[id]?.selectedOptions || [])].map(o => o.value).filter(Boolean);

export function readFilters(){
  S.f.q             = getVal('flt-search');
  S.f.type          = multi('flt-type');
  S.f.status        = multi('flt-status');
  S.f.relation      = multi('flt-relation');
  S.f.prio          = multi('flt-priority');
  S.f.legalForm     = multi('flt-legal-form');
  S.f.governance    = multi('flt-governance');
  S.f.businessModel = multi('flt-business-model');
  S.f.scoreMin      = num('flt-score', 0) || 0;
  S.f.surfaceMin    = num('flt-surface-min');
  S.f.surfaceMax    = num('flt-surface-max');
  S.f.fav           = EL['flt-fav']?.checked     || false;
  S.f.inView        = EL['flt-in-view']?.checked || false;
}

/** Compteur affiché dans le badge du bouton Filtres */
function updateFilterCount(){
  const f = S.f;
  let n = 0;
  for (const k of ['type','status','relation','prio',
                   'legalForm','governance','businessModel']){
    if ((f[k] || []).length) n++;
  }
  if (f.scoreMin)              n++;
  if (f.surfaceMin !== null)   n++;
  if (f.surfaceMax !== null)   n++;
  if (f.fav)                   n++;
  if (f.inView)                n++;
  setTxt('ui-filter-count', String(n));
  EL['ui-filter-count']?.classList.toggle('badge-acc', n > 0);
}

export function resetFilters(){
  for (const id of ['flt-type','flt-status','flt-relation','flt-priority',
                    'flt-legal-form','flt-governance','flt-business-model']){
    [...(EL[id]?.options || [])].forEach(o => o.selected = false);
  }
  for (const id of ['flt-surface-min','flt-surface-max']){
    if (EL[id]) EL[id].value = '';
  }
  if (EL['flt-score'])     EL['flt-score'].value = 0;
  if (EL['flt-score-val']) setTxt('flt-score-val', '0');
  if (EL['flt-fav'])       EL['flt-fav'].checked = false;
  if (EL['flt-in-view'])   EL['flt-in-view'].checked = false;

  S.preset = '';
  syncPresetButtons();
  readFilters();
}

function syncPresetButtons(){
  for (const [id, val] of Object.entries(PRESETS)){
    EL[id]?.classList.toggle('is-on', S.preset === val);
  }
}

/* ─── Branchement ─── */
export function initFilters(onChange){
  const run = () => { readFilters(); onChange(); };

  let timer;
  const debounced = () => { clearTimeout(timer); timer = setTimeout(run, 180); };

  on('flt-search', 'input', debounced);
  on('btn-search-clear', 'click', () => {
    if (EL['flt-search']) EL['flt-search'].value = '';
    run();
  });

  for (const id of ['flt-type','flt-status','flt-relation','flt-priority',
                    'flt-legal-form','flt-governance','flt-business-model',
                    'flt-fav','flt-in-view']){
    on(id, 'change', run);
  }

  for (const id of ['flt-surface-min','flt-surface-max']){
    on(id, 'input', debounced);
  }

  on('flt-score', 'input', () => {
    setTxt('flt-score-val', getVal('flt-score'));
    debounced();
  });

  on('btn-filters-reset', 'click', () => { resetFilters(); onChange(); });

  on('flt-sort', 'change', () => {
    S.sort = getVal('flt-sort');
    onChange();
  });

  /* Repli du panneau — le vrai conteneur */
  on('btn-filters-toggle', 'click', () => {
    const box = EL['ui-active-filters'];
    if (box) box.hidden = !box.hidden;
  });

  /* Presets : 4 boutons distincts, pas de conteneur délégué */
  for (const [id, val] of Object.entries(PRESETS)){
    on(id, 'click', () => {
      S.preset = (S.preset === val) ? '' : val;
      syncPresetButtons();
      onChange();
    });
  }

  readFilters();
}
