/* ═══════════════════════════════════════════════════════
   2 · STATE — source de vérité unique côté client
   ═══════════════════════════════════════════════════════ */

import { COLS, LS_PREFIX } from './config.js';

export const S = {
  /* Session */
  user  : null,

  /* Données brutes venant de Supabase */
  places: [],
  types : [],
  crit  : [],
  logs  : [],          // logs du lieu ouvert uniquement

  /* Dérivé */
  view  : [],          // places après filtres + tri

  /* UI */
  tab      : 'map',    // 'map' | 'table' | 'dash'
  selId    : null,     // lieu sélectionné
  editing  : null,     // brouillon de la fiche
  preset   : 'all',
  sort     : 'score_desc',
  cluster  : true,
  cols     : COLS.filter(c => c.def).map(c => c.k),

  /* Filtres */
  f: {
    q:'', type:'', status:'', relation:'', prio:'',
    scoreMin:0, scoreMax:100,
    region:'', city:'', tags:'',
    fav:false, late:false
  }
};

/* ─── Persistance locale (préférences uniquement) ─── */
const K = k => LS_PREFIX + k;

export function saveLocal(){
  try{
    localStorage.setItem(K('cols'),    JSON.stringify(S.cols));
    localStorage.setItem(K('sort'),    S.sort);
    localStorage.setItem(K('tab'),     S.tab);
    localStorage.setItem(K('cluster'), S.cluster ? '1' : '0');
  }catch(e){ /* mode privé : on ignore */ }
}

export function loadLocal(){
  try{
    const c = localStorage.getItem(K('cols'));
    if (c) S.cols = JSON.parse(c);
    const s = localStorage.getItem(K('sort'));
    if (s) S.sort = s;
    const t = localStorage.getItem(K('tab'));
    if (t) S.tab = t;
    const k = localStorage.getItem(K('cluster'));
    if (k !== null) S.cluster = k === '1';
  }catch(e){ /* données corrompues : on garde les défauts */ }
}

/* ─── Accès utilitaires ─── */
export const byId    = id => S.places.find(p => p.id === id) || null;
export const typeById = id => S.types.find(t => t.id === id) || null;
export const selected = () => byId(S.selId);
