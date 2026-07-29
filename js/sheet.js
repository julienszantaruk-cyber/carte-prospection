/* ═══════════════════════════════════════════════════════
   14 · FICHE — panneau d'édition (v2, ~50 champs)
   Aligné sur le HTML (#ui-sheet) et la table public.places
   ═══════════════════════════════════════════════════════ */

import { S, byId, typeById } from './state.js';
import { EL, on, esc, setTxt, setVal, getVal, fillSelect } from './dom.js';
import { STATUSES, RELATIONS, PRIORITIES, STARS_MAX } from './config.js';
import { computeScore, scoreCoverage, scoreBadge } from './score.js';
import * as data from './data.js';
import { ok, err, info, confirmBox } from './toast.js';
import { startPick } from './map.js';

let afterSave = () => {};
let draft     = null;
let pickMode  = false;   // sélection des coordonnées sur la carte

/* ═══ Coercition de types (les pièges Postgres) ═══ */

/** numeric / double precision → number ou null (jamais '') */
const num = v => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** int → entier ou null */
const intOrNull = v => {
  const n = num(v);
  return n === null ? null : Math.trunc(n);
};

/** date → 'YYYY-MM-DD' ou null (Postgres rejette '') */
const dateOrNull = v => {
  const s = (v ?? '').toString().trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

/** text → string nettoyée (jamais null, la base accepte '') */
const str = v => (v ?? '').toString().trim();

/** text[] → toujours un tableau */
const arr = v => Array.isArray(v) ? v.filter(Boolean).map(String) : [];

/** date SQL → valeur pour <input type="date"> */
const dateForInput = v => {
  if (!v) return '';
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : '';
};

/* ═══ Déclaration des 4 listes multi-valeurs ═══ */
/* boxId = conteneur des chips · inputId = champ d'ajout · key = colonne SQL */
const LISTS = [
  { key: 'tags',            boxId: 'f-tags',            inputId: 'f-tags-input',       max: 20, lower: true  },
  { key: 'revenue_sources', boxId: 'f-revenue-sources', inputId: 'f-revenue-input',    max: 20, lower: false },
  { key: 'activities',      boxId: 'f-activities',      inputId: 'f-activities-input', max: 30, lower: false },
  { key: 'features',        boxId: 'f-features',        inputId: 'f-features-input',   max: 30, lower: false }
];

/* ═══ Ouverture / fermeture ═══ */

export async function open(id){
  const p = id ? byId(id) : null;
  draft   = p ? normalize(structuredClone(p)) : blank();
  S.selId = p?.id || null;

  fillForm();

  const sh = EL['ui-sheet'];
  if (sh){ sh.hidden = false; sh.classList.add('is-open'); }

  if (p?.id){
    try {
      await data.loadLogs(p.id);
      renderLogs();
    } catch (e) {
      console.error(e);
      err('Journal non chargé');
    }
  } else {
    S.logs = [];
    renderLogs();
  }
}

export function close(){
  const sh = EL['ui-sheet'];
  if (sh){
    sh.classList.remove('is-open');
    setTimeout(() => { sh.hidden = true; }, 180);
  }
  setPickMode(false);
  draft   = null;
  S.selId = null;
}

/* ═══ Modèle vide — les ~50 colonnes de public.places ═══ */

function blank(){
  return {
    id: null,

    /* identité */
    name: '', type_id: S.types[0]?.id || null,
    relation: RELATIONS[0]?.v ?? '', description: '', opened_year: null,

    /* localisation */
    address: '', city: '', zip: '', country: 'France',
    lat: null, lng: null,

    /* contact */
    contact_name: '', email: '', phone: '', website: '', social: '',
    tags: [],

    /* structure juridique */
    legal_form: '', governance: '', owner: '',
    team_fte: null, volunteers: null,

    /* économie */
    business_model: '', revenue_sources: [],
    budget_annual: null, subsidy_pct: null,
    funders: '', business_notes: '',

    /* activité */
    activities: [], studios_count: null,
    residents_year: null, audience_year: null,

    /* bâti */
    surface_total: null, surface_expo: null, ceiling_h: null,
    floors: null, tenure: '', rent_month: null, charges_month: null,
    lease_end: null, features: [],
    transport: '', constraints: '',

    /* évaluation */
    ratings: {}, score: null,
    strengths: '', weaknesses: '', takeaway: '',

    /* suivi */
    status: STATUSES[0]?.v ?? '', priority: PRIORITIES[1]?.v ?? '',
    visit_date: null, next_date: null,
    next_action: '', links: '', favorite: false
  };
}

/** Garantit que les tableaux et l'objet ratings ne sont jamais null */
function normalize(p){
  for (const { key } of LISTS) p[key] = arr(p[key]);
  p.ratings  = (p.ratings && typeof p.ratings === 'object') ? p.ratings : {};
  p.favorite = !!p.favorite;
  return p;
}

/* ═══ Remplissage du formulaire ═══ */

function fillForm(){
  const d = draft;
  if (!d) return;

  /* En-tête */
  setTxt('ui-sheet-title', d.id ? (d.name || 'Sans nom') : 'Nouveau lieu');
  const t = typeById(d.type_id);
  setTxt('ui-sheet-sub',
    [t?.label, d.city].filter(Boolean).join(' · ') || 'À compléter');

  const fav = EL['btn-fav'];
  if (fav){
    fav.textContent = d.favorite ? '★' : '☆';
    fav.classList.toggle('is-active', !!d.favorite);
    fav.setAttribute('aria-pressed', String(!!d.favorite));
  }
  if (EL['btn-del']) EL['btn-del'].hidden = !d.id;
  if (EL['btn-dup']) EL['btn-dup'].hidden = !d.id;

  /* Selects dynamiques */
  fillSelect('f-type',     S.types.map(x => ({ v: x.id, l: `${x.emoji} ${x.label}` })));
  fillSelect('f-status',   STATUSES);
  fillSelect('f-relation', RELATIONS);
  fillSelect('f-priority', PRIORITIES);

  if (EL['f-type'])     EL['f-type'].value     = d.type_id  || '';
  if (EL['f-status'])   EL['f-status'].value   = d.status   || '';
  if (EL['f-relation']) EL['f-relation'].value = d.relation || '';
  if (EL['f-priority']) EL['f-priority'].value = d.priority || '';  // text, pas Number

  /* Identité */
  setVal('f-name',        d.name);
  setVal('f-description', d.description);
  setVal('f-opened-year', d.opened_year ?? '');

  /* Localisation */
  setVal('f-address', d.address);
  setVal('f-city',    d.city);
  setVal('f-zip',     d.zip);
  setVal('f-country', d.country);
  setVal('f-lat',     d.lat ?? '');
  setVal('f-lng',     d.lng ?? '');

  /* Contact */
  setVal('f-contact-name', d.contact_name);
  setVal('f-email',        d.email);
  setVal('f-phone',        d.phone);
  setVal('f-website',      d.website);
  setVal('f-social',       d.social);

  /* Structure juridique */
  setVal('f-legal-form', d.legal_form);
  setVal('f-governance', d.governance);
  setVal('f-owner',      d.owner);
  setVal('f-team-fte',   d.team_fte   ?? '');
  setVal('f-volunteers', d.volunteers ?? '');

  /* Économie */
  setVal('f-business-model', d.business_model);
  setVal('f-budget-annual',  d.budget_annual ?? '');
  setVal('f-subsidy-pct',    d.subsidy_pct   ?? '');
  setVal('f-funders',        d.funders);
  setVal('f-business-notes', d.business_notes);

  /* Activité */
  setVal('f-studios-count',  d.studios_count  ?? '');
  setVal('f-residents-year', d.residents_year ?? '');
  setVal('f-audience-year',  d.audience_year  ?? '');

  /* Bâti */
  setVal('f-surface-total', d.surface_total ?? '');
  setVal('f-surface-expo',  d.surface_expo  ?? '');
  setVal('f-ceiling-h',     d.ceiling_h     ?? '');
  setVal('f-floors',        d.floors        ?? '');
  setVal('f-tenure',        d.tenure);
  setVal('f-rent-month',    d.rent_month    ?? '');
  setVal('f-charges-month', d.charges_month ?? '');
  setVal('f-lease-end',     dateForInput(d.lease_end));
  setVal('f-transport',     d.transport);
  setVal('f-constraints',   d.constraints);

  /* Évaluation */
  setVal('f-strengths',  d.strengths);
  setVal('f-weaknesses', d.weaknesses);
  setVal('f-takeaway',   d.takeaway);

  /* Suivi */
  setVal('f-visit-date',  dateForInput(d.visit_date));
  setVal('f-next-date',   dateForInput(d.next_date));
  setVal('f-next-action', d.next_action);
  setVal('f-links',       d.links);

  /* Listes + notation */
  renderAllLists();
  renderRatings();
}

/* ═══ Listes multi-valeurs (générique — une seule implémentation) ═══ */

function renderList(cfg){
  const box = EL[cfg.boxId];
  if (!box) return;
  const items = arr(draft?.[cfg.key]);
  box.innerHTML = items.length
    ? items.map((v, i) =>
        `<span class="chip">${esc(v)}<button type="button" class="chip-x"
           data-idx="${i}" aria-label="Retirer ${esc(v)}">×</button></span>`
      ).join('')
    : '<span class="muted">Aucun élément</span>';
}

function renderAllLists(){
  for (const cfg of LISTS) renderList(cfg);
}

function addToList(cfg){
  if (!draft) return;
  const raw = getVal(cfg.inputId).trim();
  if (!raw) return;

  draft[cfg.key] = arr(draft[cfg.key]);
  for (let v of raw.split(',').map(s => s.trim()).filter(Boolean)){
    if (cfg.lower) v = v.toLowerCase();
    if (!draft[cfg.key].includes(v) && draft[cfg.key].length < cfg.max){
      draft[cfg.key].push(v);
    }
  }
  setVal(cfg.inputId, '');
  renderList(cfg);
}

function bindList(cfg){
  on(cfg.inputId, 'keydown', e => {
    if (e.key === 'Enter' || e.key === ','){ e.preventDefault(); addToList(cfg); }
  });
  on(cfg.inputId, 'blur', () => addToList(cfg));

  EL[cfg.boxId]?.addEventListener('click', e => {
    const b = e.target.closest('[data-idx]');
    if (!b || !draft) return;
    draft[cfg.key] = arr(draft[cfg.key]);
    draft[cfg.key].splice(Number(b.dataset.idx), 1);
    renderList(cfg);
  });
}

/* ═══ Notation par étoiles + score live ═══ */

function renderRatings(){
  const box = EL['ui-ratings'];
  if (!box) return;

  if (!S.crit.length){
    box.innerHTML = '<p class="muted">Aucun critère défini. Réglages → Critères.</p>';
    setTxt('ui-score-live', '—');
    return;
  }

  box.innerHTML = S.crit.map(c => {
    const v = draft?.ratings?.[c.id] || 0;
    const stars = Array.from({ length: STARS_MAX }, (_, i) =>
      `<button type="button" class="star${i < v ? ' is-active' : ''}"
               data-crit="${c.id}" data-val="${i + 1}"
               title="${i + 1}/${STARS_MAX}"
               aria-label="${esc(c.label)} : ${i + 1} sur ${STARS_MAX}">★</button>`
    ).join('');
    return `<div class="rating">
      <div class="rating-head">
        <span class="rating-lbl">${esc(c.label)}</span>
        <span class="rating-w">×${c.weight}</span>
      </div>
      <div class="rating-stars">${stars}
        ${v ? `<button type="button" class="star-clr" data-crit="${c.id}"
                 data-val="0" title="Effacer">↺</button>` : ''}
      </div>
    </div>`;
  }).join('');

  updateScore();
}

function updateScore(){
  const el = EL['ui-score-live'];
  if (!el || !draft) return;
  const sc  = computeScore(draft.ratings, S.crit);
  const cov = scoreCoverage(draft.ratings, S.crit);
  draft.score      = sc;
  el.textContent   = sc === null ? '—' : sc;
  el.className     = 'score-big badge ' + scoreBadge(sc);
  el.title         = `${cov.done}/${cov.total} critères notés`;
}

/* ═══ Journal ═══ */

function renderLogs(){
  const box = EL['ui-logs'];
  if (!box) return;

  if (!draft?.id){
    box.innerHTML = '<p class="muted">Enregistre le lieu pour ajouter des notes.</p>';
    return;
  }
  box.innerHTML = S.logs.length
    ? S.logs.map(l => `<div class="log">
        <div class="log-date">${esc(String(l.created_at).slice(0, 16).replace('T', ' '))}
          <button type="button" class="log-x" data-log="${l.id}"
                  aria-label="Supprimer la note">×</button></div>
        <div class="log-body">${esc(l.body)}</div>
      </div>`).join('')
    : '<p class="muted">Aucune note.</p>';
}

/* ═══ Lecture du formulaire — coercition stricte ═══ */

function readForm(){
  if (!draft) return;
  const d = draft;

  /* identité */
  d.name        = str(getVal('f-name'));
  d.type_id     = getVal('f-type') || null;
  d.relation    = str(getVal('f-relation'));
  d.description = str(getVal('f-description'));
  d.opened_year = intOrNull(getVal('f-opened-year'));

  /* localisation */
  d.address = str(getVal('f-address'));
  d.city    = str(getVal('f-city'));
  d.zip     = str(getVal('f-zip'));
  d.country = str(getVal('f-country'));
  d.lat     = num(getVal('f-lat'));
  d.lng     = num(getVal('f-lng'));

  /* contact */
  d.contact_name = str(getVal('f-contact-name'));
  d.email        = str(getVal('f-email'));
  d.phone        = str(getVal('f-phone'));
  d.website      = str(getVal('f-website'));
  d.social       = str(getVal('f-social'));

  /* structure juridique */
  d.legal_form = str(getVal('f-legal-form'));
  d.governance = str(getVal('f-governance'));
  d.owner      = str(getVal('f-owner'));
  d.team_fte   = num(getVal('f-team-fte'));
  d.volunteers = intOrNull(getVal('f-volunteers'));

  /* économie */
  d.business_model = str(getVal('f-business-model'));
  d.budget_annual  = intOrNull(getVal('f-budget-annual'));
  d.subsidy_pct    = intOrNull(getVal('f-subsidy-pct'));
  d.funders        = str(getVal('f-funders'));
  d.business_notes = str(getVal('f-business-notes'));

  /* activité */
  d.studios_count  = intOrNull(getVal('f-studios-count'));
  d.residents_year = intOrNull(getVal('f-residents-year'));
  d.audience_year  = intOrNull(getVal('f-audience-year'));

  /* bâti */
  d.surface_total = num(getVal('f-surface-total'));
  d.surface_expo  = num(getVal('f-surface-expo'));
  d.ceiling_h     = num(getVal('f-ceiling-h'));
  d.floors        = intOrNull(getVal('f-floors'));
  d.tenure        = str(getVal('f-tenure'));
  d.rent_month    = intOrNull(getVal('f-rent-month'));
  d.charges_month = intOrNull(getVal('f-charges-month'));
  d.lease_end     = dateOrNull(getVal('f-lease-end'));
  d.transport     = str(getVal('f-transport'));
  d.constraints   = str(getVal('f-constraints'));

  /* évaluation */
  d.strengths  = str(getVal('f-strengths'));
  d.weaknesses = str(getVal('f-weaknesses'));
  d.takeaway   = str(getVal('f-takeaway'));
  d.ratings    = (d.ratings && typeof d.ratings === 'object') ? d.ratings : {};
  d.score      = computeScore(d.ratings, S.crit);

  /* suivi — priority reste une STRING */
  d.status      = str(getVal('f-status'));
  d.priority    = str(getVal('f-priority'));
  d.visit_date  = dateOrNull(getVal('f-visit-date'));
  d.next_date   = dateOrNull(getVal('f-next-date'));
  d.next_action = str(getVal('f-next-action'));
  d.links       = str(getVal('f-links'));

  /* listes — jamais null */
  for (const { key } of LISTS) d[key] = arr(d[key]);
}

/* ═══ Géocodage Nominatim ═══ */

async function geocode(){
  readForm();
  const q = [draft.address, draft.zip, draft.city, draft.country || 'France']
    .filter(Boolean).join(', ');

  if (!draft.address && !draft.city && !draft.zip){
    return err('Renseigne au moins une ville ou une adresse.');
  }

  info('Recherche des coordonnées…');
  try {
    const r = await fetch(
      'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' +
      encodeURIComponent(q),
      { headers: { 'Accept': 'application/json' } }
    );
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    if (!j.length) return err('Adresse introuvable.');

    draft.lat = Number(j[0].lat);
    draft.lng = Number(j[0].lon);
    setVal('f-lat', draft.lat.toFixed(6));
    setVal('f-lng', draft.lng.toFixed(6));
    ok('Coordonnées trouvées');
  } catch (e) {
    console.error(e);
    err('Échec du géocodage (réseau ?)');
  }
}

/* ═══ Sélection des coordonnées sur la carte ═══ */

function setPickMode(v){
  pickMode = !!v;
  const btn = EL['btn-pick-map'];
  if (btn){
    btn.classList.toggle('is-active', pickMode);
    btn.setAttribute('aria-pressed', String(pickMode));
  }
  document.body.classList.toggle('is-picking', pickMode);
}

/** Appelée par map.js quand l'utilisateur clique sur la carte. */
export function isPicking(){ return pickMode; }

export function applyPickedCoords(lat, lng){
  if (!pickMode || !draft) return false;
  draft.lat = Number(lat);
  draft.lng = Number(lng);
  setVal('f-lat', draft.lat.toFixed(6));
  setVal('f-lng', draft.lng.toFixed(6));
  setPickMode(false);
  ok('Coordonnées relevées sur la carte');
  return true;
}

/* ═══ Enregistrement / suppression / duplication ═══ */

async function save(){
  if (!draft) return;
  readForm();

  if (!draft.name){
    err('Le nom est obligatoire.');
    EL['f-name']?.focus();
    return;
  }

  const btn = EL['btn-save'];
  if (btn) btn.disabled = true;

  try {
    const saved = await data.savePlace(draft);
    draft.id = saved.id;
    S.selId  = saved.id;
    ok('Lieu enregistré');
    fillForm();
    renderLogs();
    afterSave();
  } catch (e) {
    console.error(e);
    err('Échec de l\'enregistrement : ' + (e.message || 'erreur inconnue'));
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function remove(){
  if (!draft?.id) return;
  if (!await confirmBox(`Supprimer « ${draft.name || 'ce lieu'} » définitivement ?`)) return;
  try {
    await data.deletePlace(draft.id);
    ok('Lieu supprimé');
    close();
    afterSave();
  } catch (e) {
    console.error(e);
    err('Suppression impossible');
  }
}

async function duplicate(){
  if (!draft?.id) return;
  readForm();
  const copy = { ...structuredClone(draft), id: null, name: draft.name + ' (copie)' };
  try {
    const saved = await data.savePlace(copy);
    ok('Lieu dupliqué');
    afterSave();
    await open(saved.id);
  } catch (e) {
    console.error(e);
    err('Duplication impossible');
  }
}

/* ═══ Init ═══ */

export function initSheet(onChange){
  afterSave = onChange || afterSave;

  on('btn-sheet-close', 'click', close);
  on('btn-save',        'click', save);
  on('btn-del',         'click', remove);
  on('btn-dup',         'click', duplicate);
  on('btn-geocode',     'click', geocode);

    on('btn-pick-map', 'click', () => {
    if (!draft) return;
    setPickMode(true);
    info('Clique sur la carte pour poser le point.');
    startPick((lat, lng) => {
      draft.lat = lat;
      draft.lng = lng;
      setVal('f-lat', lat.toFixed(6));
      setVal('f-lng', lng.toFixed(6));
      setPickMode(false);
      ok(`Coordonnées relevées : ${lat}, ${lng}`);
    });
  });

  /* Favori */
  on('btn-fav', 'click', async () => {
    if (!draft) return;
    draft.favorite = !draft.favorite;
    const b = EL['btn-fav'];
    if (b){
      b.textContent = draft.favorite ? '★' : '☆';
      b.classList.toggle('is-active', draft.favorite);
      b.setAttribute('aria-pressed', String(draft.favorite));
    }
    if (draft.id){
      try { await data.toggleFav(draft.id); afterSave(); }
      catch (e) { console.error(e); err('Échec de la mise à jour'); }
    }
  });

  /* Les 4 listes multi-valeurs */
  for (const cfg of LISTS) bindList(cfg);

  /* Notation */
  EL['ui-ratings']?.addEventListener('click', e => {
    const b = e.target.closest('[data-crit]');
    if (!b || !draft) return;
    const id = b.dataset.crit;
    const v  = Number(b.dataset.val);
    draft.ratings = draft.ratings || {};
    if (v === 0) delete draft.ratings[id];
    else draft.ratings[id] = v;
    renderRatings();
  });

  /* Titre / sous-titre vivants */
  on('f-name', 'input', () => {
    setTxt('ui-sheet-title', getVal('f-name') || 'Nouveau lieu');
  });
  on('f-city', 'input', () => {
    const t = typeById(getVal('f-type'));
    setTxt('ui-sheet-sub',
      [t?.label, getVal('f-city')].filter(Boolean).join(' · ') || 'À compléter');
  });
  on('f-type', 'change', () => {
    const t = typeById(getVal('f-type'));
    setTxt('ui-sheet-sub',
      [t?.label, getVal('f-city')].filter(Boolean).join(' · ') || 'À compléter');
  });

  /* Journal */
  on('btn-log-add', 'click', async () => {
    if (!draft?.id) return err('Enregistre d\'abord le lieu.');
    const body = getVal('f-log-body').trim();
    if (!body) return;
    try {
      await data.addLog(draft.id, body);
      setVal('f-log-body', '');
      renderLogs();
      ok('Note ajoutée');
    } catch (e) {
      console.error(e);
      err('Note non ajoutée');
    }
  });

  EL['ui-logs']?.addEventListener('click', async e => {
    const b = e.target.closest('[data-log]');
    if (!b) return;
    try { await data.deleteLog(b.dataset.log); renderLogs(); }
    catch (e2) { console.error(e2); err('Suppression impossible'); }
  });

  /* Raccourcis clavier */
  document.addEventListener('keydown', e => {
    const sh = EL['ui-sheet'];
    const isOpen = sh && !sh.hidden;

    if (e.key === 'Escape' && isOpen){
      if (pickMode) { setPickMode(false); return; }
      close();
    }
    if (isOpen && (e.ctrlKey || e.metaKey) && e.key === 's'){
      e.preventDefault();
      save();
    }
  });
}
