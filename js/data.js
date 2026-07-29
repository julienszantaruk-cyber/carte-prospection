/* ═══════════════════════════════════════════════════════
   8 · DATA — accès Supabase (le seul fichier qui requête)
   ═══════════════════════════════════════════════════════ */

import { sb } from './auth.js';
import { S } from './state.js';
import * as sane from './sanitize.js';
import { computeScore } from './score.js';

/* ─── Types de lieux ─── */
export async function loadTypes(){
  const { data, error } = await sb.from('place_types')
    .select('*').order('sort_order').order('label');
  if (error) throw error;
  S.types = data || [];
  return S.types;
}

export async function saveType(t){
  const row = {
    label      : sane.txt(t.label, 80) || 'Sans nom',
    emoji      : sane.txt(t.emoji, 8)  || '📍',
    color      : sane.txt(t.color, 9)  || '#6366f1',
    sort_order : sane.int(t.sort_order, 0, 999) ?? 0
  };
  if (t.id){
    const { error } = await sb.from('place_types').update(row).eq('id', t.id);
    if (error) throw error;
  } else {
    row.user_id = S.user.id;
    const { error } = await sb.from('place_types').insert(row);
    if (error) throw error;
  }
  return loadTypes();
}

export async function deleteType(id){
  const { error } = await sb.from('place_types').delete().eq('id', id);
  if (error) throw error;
  return loadTypes();
}

/* ─── Critères ─── */
export async function loadCriteria(){
  const { data, error } = await sb.from('criteria')
    .select('*').order('sort_order').order('label');
  if (error) throw error;
  S.crit = data || [];
  return S.crit;
}

export async function saveCriterion(c){
  const row = {
    label      : sane.txt(c.label, 80) || 'Sans nom',
    weight     : sane.int(c.weight, 1, 10) ?? 1,
    sort_order : sane.int(c.sort_order, 0, 999) ?? 0
  };
  if (c.id){
    const { error } = await sb.from('criteria').update(row).eq('id', c.id);
    if (error) throw error;
  } else {
    row.user_id = S.user.id;
    const { error } = await sb.from('criteria').insert(row);
    if (error) throw error;
  }
  return loadCriteria();
}

export async function deleteCriterion(id){
  const { error } = await sb.from('criteria').delete().eq('id', id);
  if (error) throw error;
  return loadCriteria();
}

/* ─── Lieux ─── */
export async function loadPlaces(){
  const { data, error } = await sb.from('places')
    .select('*').order('updated_at', { ascending:false });
  if (error) throw error;
  S.places = data || [];
  return S.places;
}

export async function savePlace(draft){
  const row   = sane.place(draft);
  row.score   = computeScore(row.ratings, S.crit);

  if (draft.id){
    const { data, error } = await sb.from('places')
      .update(row).eq('id', draft.id).select().single();
    if (error) throw error;
    const i = S.places.findIndex(p => p.id === draft.id);
    if (i >= 0) S.places[i] = data;
    return data;
  }

  row.user_id = S.user.id;
  const { data, error } = await sb.from('places')
    .insert(row).select().single();
  if (error) throw error;
  S.places.unshift(data);
  return data;
}

export async function deletePlace(id){
  const { error } = await sb.from('places').delete().eq('id', id);
  if (error) throw error;
  S.places = S.places.filter(p => p.id !== id);
}

export async function toggleFav(id){
  const p = S.places.find(x => x.id === id);
  if (!p) return;
  const next = !p.favorite;
  const { error } = await sb.from('places')
    .update({ favorite: next }).eq('id', id);
  if (error) throw error;
  p.favorite = next;
  return next;
}

/** Recalcule tous les scores (après changement de pondération) */
export async function recalcAll(){
  let changed = 0;
  for (const p of S.places){
    const next = computeScore(p.ratings, S.crit);
    if (next !== p.score){
      const { error } = await sb.from('places')
        .update({ score: next }).eq('id', p.id);
      if (!error){ p.score = next; changed++; }
    }
  }
  return changed;
}

/* ─── Journal ─── */
export async function loadLogs(placeId){
  const { data, error } = await sb.from('place_logs')
    .select('*').eq('place_id', placeId)
    .order('created_at', { ascending:false });
  if (error) throw error;
  S.logs = data || [];
  return S.logs;
}

export async function addLog(placeId, body){
  const clean = sane.txt(body, 4000);
  if (!clean) return null;
  const { data, error } = await sb.from('place_logs').insert({
    user_id : S.user.id,
    place_id: placeId,
    body    : clean
  }).select().single();
  if (error) throw error;
  S.logs.unshift(data);
  return data;
}

export async function deleteLog(id){
  const { error } = await sb.from('place_logs').delete().eq('id', id);
  if (error) throw error;
  S.logs = S.logs.filter(l => l.id !== id);
}

/* ─── Seed : types + critères par défaut au premier login ─── */
const SEED_TYPES = [
  { label:'Salle de concert', emoji:'🎤', color:'#6366f1', sort_order:1 },
  { label:'Théâtre',          emoji:'🎭', color:'#a855f7', sort_order:2 },
  { label:'Café-concert',     emoji:'☕', color:'#f59e0b', sort_order:3 },
  { label:'Festival',         emoji:'🎪', color:'#ec4899', sort_order:4 },
  { label:'Centre culturel',  emoji:'🏛️', color:'#14b8a6', sort_order:5 },
  { label:'Médiathèque',      emoji:'📚', color:'#3b82f6', sort_order:6 },
  { label:'Bar / Pub',        emoji:'🍺', color:'#eab308', sort_order:7 },
  { label:'Plein air',        emoji:'🌳', color:'#22c55e', sort_order:8 },
  { label:'Autre',            emoji:'📍', color:'#64748b', sort_order:99 }
];

const SEED_CRIT = [
  { label:'Adéquation artistique', weight:5, sort_order:1 },
  { label:'Jauge adaptée',         weight:4, sort_order:2 },
  { label:'Conditions financières',weight:4, sort_order:3 },
  { label:'Qualité technique',     weight:3, sort_order:4 },
  { label:'Accessibilité',         weight:2, sort_order:5 },
  { label:'Réactivité du contact', weight:3, sort_order:6 }
];

export async function seedIfEmpty(){
  await Promise.all([loadTypes(), loadCriteria()]);

  const jobs = [];
  if (S.types.length === 0){
    jobs.push(
      sb.from('place_types').insert(
        SEED_TYPES.map(t => ({ ...t, user_id: S.user.id }))
      )
    );
  }
  if (S.crit.length === 0){
    jobs.push(
      sb.from('criteria').insert(
        SEED_CRIT.map(c => ({ ...c, user_id: S.user.id }))
      )
    );
  }

  if (jobs.length){
    const res = await Promise.all(jobs);
    for (const r of res) if (r.error) console.error('[seed]', r.error);
    await Promise.all([loadTypes(), loadCriteria()]);
  }
}

/** Chargement complet après connexion */
export async function loadAll(){
  await seedIfEmpty();
  await loadPlaces();
}
