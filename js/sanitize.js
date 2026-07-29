/* ═══════════════════════════════════════════════════════
   5 · SANITIZE — normalisation avant écriture
   ═══════════════════════════════════════════════════════ */

import { STATUSES, RELATIONS } from './config.js';

const STATUS_VALUES   = STATUSES.map(s => s.v);
const RELATION_VALUES = RELATIONS.map(r => r.v);

/** Texte : trim, longueur max, chaîne vide → null */
export function txt(v, max = 300){
  if (v === null || v === undefined) return null;
  const s = String(v).trim().slice(0, max);
  return s === '' ? null : s;
}

/** Nombre borné, ou null */
export function num(v, min = -Infinity, max = Infinity){
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

/** Entier borné, ou null */
export function int(v, min, max){
  const n = num(v, min, max);
  return n === null ? null : Math.round(n);
}

/** Latitude : -90 → 90 */
export const lat = v => num(v, -90, 90);

/** Longitude : -180 → 180 */
export const lng = v => num(v, -180, 180);

/** Email : validation simple, sinon null */
export function email(v){
  const s = txt(v, 200);
  if (!s) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s.toLowerCase() : null;
}

/** URL : ajoute https:// si absent, rejette si invalide */
export function url(v){
  let s = txt(v, 400);
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try{ new URL(s); return s; }
  catch{ return null; }
}

/** Téléphone : garde chiffres, +, espaces, tirets, parenthèses */
export function phone(v){
  const s = txt(v, 40);
  if (!s) return null;
  const cleaned = s.replace(/[^\d+\s().-]/g, '').trim();
  return cleaned === '' ? null : cleaned;
}

/** Date ISO (YYYY-MM-DD) ou null */
export function date(v){
  const s = txt(v, 10);
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Code postal : 3 à 10 caractères alphanumériques */
export function postcode(v){
  const s = txt(v, 10);
  if (!s) return null;
  const c = s.replace(/[^\w\s-]/g, '').trim();
  return c.length >= 3 ? c : null;
}

/** Valeur d'une liste fermée, sinon fallback */
export function pick(v, allowed, fallback){
  return allowed.includes(v) ? v : fallback;
}

export const status   = v => pick(v, STATUS_VALUES,   'a_contacter');
export const relation = v => pick(v, RELATION_VALUES, 'aucune');

/** Tags : tableau propre, minuscules, dédupliqué, max 20 */
export function tags(v){
  const arr = Array.isArray(v) ? v : String(v ?? '').split(',');
  const out = [];
  for (let t of arr){
    t = String(t).trim().toLowerCase().slice(0, 40);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= 20) break;
  }
  return out;
}

/** Objet complet prêt pour un insert/update dans `places` */
export function place(raw){
  return {
    name      : txt(raw.name, 200) || 'Sans nom',
    type_id   : txt(raw.type_id, 40),
    status    : status(raw.status),
    relation  : relation(raw.relation),
    priority  : int(raw.priority, 1, 4) ?? 2,
    favorite  : !!raw.favorite,

    address   : txt(raw.address, 300),
    postcode  : postcode(raw.postcode),
    city      : txt(raw.city, 120),
    region    : txt(raw.region, 120),
    lat       : lat(raw.lat),
    lng       : lng(raw.lng),

    contact_name : txt(raw.contact_name, 160),
    contact_role : txt(raw.contact_role, 120),
    email        : email(raw.email),
    phone        : phone(raw.phone),
    website      : url(raw.website),

    capacity  : int(raw.capacity, 0, 1000000),
    fee       : txt(raw.fee, 200),
    tech      : txt(raw.tech, 2000),
    access    : txt(raw.access, 2000),

    tags      : tags(raw.tags),
    next_step : txt(raw.next_step, 300),
    next_date : date(raw.next_date),
    notes     : txt(raw.notes, 8000),

    ratings   : ratings(raw.ratings)
  };
}

/** Notations : { criterionId: 0..5 } */
export function ratings(v){
  if (!v || typeof v !== 'object') return {};
  const out = {};
  for (const [k, val] of Object.entries(v)){
    const n = int(val, 0, 5);
    if (n !== null && n > 0) out[k] = n;
  }
  return out;
}
