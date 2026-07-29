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

/** Génère une key unique : slug du label, suffixée si collision. */
function freshKey(label, excludeId = null){
  const base = sane.slug(label) || 'critere';
  const taken = new Set(
    S.crit.filter(c => c.id !== excludeId).map(c => c.key)
  );
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

export async function saveCriterion(c){
  const label = sane.txt(c.label, 80) || 'Sans nom';
  const row = {
    label,
    weight     : sane.dec(c.weight, 0, 10) ?? 1,   // numeric : décimales gardées
    sort_order : sane.int(c.sort_order, 0, 999) ?? 0
  };

  if (c.id){
    // key immuable : les ratings existants la référencent
    const { error } = await sb.from('criteria').update(row).eq('id', c.id);
    if (error) throw error;
  } else {
    row.user_id = S.user.id;
    row.key     = freshKey(label);
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
  const row = sane.place(draft);
  row.score = computeScore(row.ratings, S.crit);

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

/* ─── Seed : délégué au SQL (public.seed_defaults) ─── */

export async function seedDefaults(){
  const { error } = await sb.rpc('seed_defaults');
  if (error) console.error('[seed]', error);
}

/** Chargement complet après connexion */
export async function loadAll(){
  await seedDefaults();
  await Promise.all([loadTypes(), loadCriteria()]);
  await loadPlaces();
}
