/* ═══════════════════════════════════════════════════════
   5 · SANITIZE — normalisation avant écriture
   Aligné sur le schéma SQL (bloc 3 : places).
   ═══════════════════════════════════════════════════════ */

import { STATUSES, RELATIONS } from './config.js';

const STATUS_VALUES   = STATUSES.map(s => s.v);
const RELATION_VALUES = RELATIONS.map(r => r.v);

/* ─── Primitives ─── */

export function txt(v, max = 300){
  if (v === null || v === undefined) return null;
  const s = String(v).trim().slice(0, max);
  return s === '' ? null : s;
}

export function num(v, min = -Infinity, max = Infinity){
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

export function int(v, min, max){
  const n = num(v, min, max);
  return n === null ? null : Math.round(n);
}

/** numeric Postgres : garde les décimales, 2 chiffres */
export function dec(v, min, max){
  const n = num(v, min, max);
  return n === null ? null : Math.round(n * 100) / 100;
}

export const lat = v => dec(v, -90, 90);
export const lng = v => dec(v, -180, 180);

export function email(v){
  const s = txt(v, 200);
  if (!s) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s.toLowerCase() : null;
}

export function url(v){
  let s = txt(v, 400);
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try { new URL(s); return s; } catch { return null; }
}

export function phone(v){
  const s = txt(v, 40);
  if (!s) return null;
  const c = s.replace(/[^\d+\s().-]/g, '').trim();
  return c === '' ? null : c;
}

export function date(v){
  const s = txt(v, 10);
  if (!s) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** zip (SQL: zip) — 3 à 10 caractères */
export function zip(v){
  const s = txt(v, 10);
  if (!s) return null;
  const c = s.replace(/[^\w\s-]/g, '').trim();
  return c.length >= 3 ? c : null;
}

export function pick(v, allowed, fallback = null){
  return allowed.includes(v) ? v : fallback;
}

export const status   = v => pick(v, STATUS_VALUES,   'a_contacter');
export const relation = v => pick(v, RELATION_VALUES, 'aucune');

/** priority : entier 1..4 stocké en text (SQL: text) */
export function priority(v){
  const n = int(v, 1, 4);
  return n === null ? '2' : String(n);
}

/* ─── Tableaux text[] ─── */

/** Normalise en text[] : trim, dédup, max N. Accepte array ou CSV. */
export function arr(v, { max = 30, len = 60, lower = false } = {}){
  const src = Array.isArray(v) ? v : String(v ?? '').split(',');
  const out = [];
  for (let x of src){
    x = String(x).trim().slice(0, len);
    if (lower) x = x.toLowerCase();
    if (x && !out.includes(x)) out.push(x);
    if (out.length >= max) break;
  }
  return out;
}

export const tags           = v => arr(v, { max:20, len:40, lower:true });
export const revenueSources = v => arr(v, { max:15, len:80 });
export const activities     = v => arr(v, { max:20, len:80 });
export const features       = v => arr(v, { max:25, len:80 });

/* ─── Notations (jsonb) ─── */

/** { criteriaKey: 1..5 } — les 0 et non-notés sont retirés */
export function ratings(v){
  if (!v || typeof v !== 'object') return {};
  const out = {};
  for (const [k, val] of Object.entries(v)){
    const key = txt(k, 60);
    const n   = int(val, 0, 5);
    if (key && n !== null && n > 0) out[key] = n;
  }
  return out;
}

/* ─── Slug (pour criteria.key) ─── */

export function slug(v, max = 60){
  const s = String(v ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, max);
  return s || null;
}

/* ═══════════════════════════════════════════════════════
   Objet `places` complet — 1 clé par colonne SQL
   ═══════════════════════════════════════════════════════ */

export function place(raw){
  return {
    /* identité */
    name        : txt(raw.name, 200) || 'Sans nom',
    type_id     : txt(raw.type_id, 40),
    relation    : relation(raw.relation),
    description : txt(raw.description, 4000),
    opened_year : int(raw.opened_year, 1000, 2100),

    /* localisation */
    address : txt(raw.address, 300),
    city    : txt(raw.city, 120),
    zip     : zip(raw.zip),
    country : txt(raw.country, 120),
    lat     : lat(raw.lat),
    lng     : lng(raw.lng),

    /* contact */
    contact_name : txt(raw.contact_name, 160),
    email        : email(raw.email),
    phone        : phone(raw.phone),
    website      : url(raw.website),
    social       : txt(raw.social, 400),
    tags         : tags(raw.tags),

    /* structure juridique */
    legal_form : txt(raw.legal_form, 120),
    governance : txt(raw.governance, 200),
    owner      : txt(raw.owner, 200),
    team_fte   : dec(raw.team_fte, 0, 10000),
    volunteers : int(raw.volunteers, 0, 100000),

    /* économie */
    business_model  : txt(raw.business_model, 200),
    revenue_sources : revenueSources(raw.revenue_sources),
    budget_annual   : int(raw.budget_annual, 0, 1e9),
    subsidy_pct     : int(raw.subsidy_pct, 0, 100),
    funders         : txt(raw.funders, 1000),
    business_notes  : txt(raw.business_notes, 4000),

    /* activité */
    activities     : activities(raw.activities),
    studios_count  : int(raw.studios_count, 0, 10000),
    residents_year : int(raw.residents_year, 0, 100000),
    audience_year  : int(raw.audience_year, 0, 1e8),

    /* bâti */
    surface_total : dec(raw.surface_total, 0, 1e7),
    surface_expo  : dec(raw.surface_expo, 0, 1e7),
    ceiling_h     : dec(raw.ceiling_h, 0, 200),
    floors        : int(raw.floors, 0, 200),
    tenure        : txt(raw.tenure, 120),
    rent_month    : int(raw.rent_month, 0, 1e8),
    charges_month : int(raw.charges_month, 0, 1e8),
    lease_end     : date(raw.lease_end),
    features      : features(raw.features),
    transport     : txt(raw.transport, 1000),
    constraints   : txt(raw.constraints, 2000),

    /* évaluation */
    ratings    : ratings(raw.ratings),
    strengths  : txt(raw.strengths, 2000),
    weaknesses : txt(raw.weaknesses, 2000),
    takeaway   : txt(raw.takeaway, 2000),
    /* score : calculé dans data.savePlace() */

    /* suivi */
    status      : status(raw.status),
    priority    : priority(raw.priority),
    visit_date  : date(raw.visit_date),
    next_date   : date(raw.next_date),
    next_action : txt(raw.next_action, 300),
    links       : txt(raw.links, 2000),
    favorite    : !!raw.favorite
  };
}
