/* ═══════════════════════════════════════════════════════
   14 · FICHE — panneau d'édition
   ═══════════════════════════════════════════════════════ */

import { S, byId, typeById } from './state.js';
import { EL, on, esc, setTxt, setVal, getVal, fillSelect } from './dom.js';
import { STATUSES, RELATIONS, PRIORITIES, STARS_MAX } from './config.js';
import { computeScore, scoreCoverage, scoreBadge } from './score.js';
import * as data from './data.js';
import { ok, err, confirmBox } from './toast.js';

let afterSave = () => {};
let draft = null;

/* ─── Ouverture ─── */
export async function open(id){
  const p = id ? byId(id) : null;
  draft = p ? structuredClone(p) : blank();
  S.selId = p?.id || null;

  fillForm();
  const sh = EL['sheet'];
  if (sh){ sh.hidden = false; sh.classList.add('is-open'); }

  if (p?.id){
    try{
      await data.loadLogs(p.id);
      renderLogs();
    }catch(e){ console.error(e); }
  } else {
    S.logs = [];
    renderLogs();
  }
}

export function close(){
  const sh = EL['sheet'];
  if (sh){
    sh.classList.remove('is-open');
    setTimeout(() => { sh.hidden = true; }, 180);
  }
  draft = null;
  S.selId = null;
}

function blank(){
  return {
    id:null, name:'', type_id:S.types[0]?.id || null,
    status:'a_contacter', relation:'aucune', priority:2, favorite:false,
    address:'', postcode:'', city:'', region:'', lat:null, lng:null,
    contact_name:'', contact_role:'', email:'', phone:'', website:'',
    capacity:null, fee:'', tech:'', access:'',
    tags:[], next_step:'', next_date:'', notes:'',
    ratings:{}
  };
}

/* ─── Remplissage ─── */
function fillForm(){
  const d = draft;

  setTxt('ui-sheet-title', d.id ? d.name || 'Sans nom' : 'Nouveau lieu');
  const t = typeById(d.type_id);
  setTxt('ui-sheet-sub', [t?.label, d.city].filter(Boolean).join(' · ') || 'À compléter');

  const fav = EL['btn-fav'];
  if (fav){
    fav.textContent = d.favorite ? '★' : '☆';
    fav.classList.toggle('is-active', !!d.favorite);
  }
  if (EL['btn-del']) EL['btn-del'].hidden = !d.id;
  if (EL['btn-dup']) EL['btn-dup'].hidden = !d.id;

  fillSelect('f-type',     S.types.map(x => ({ v:x.id, l:x.emoji + ' ' + x.label })));
  fillSelect('f-status',   STATUSES);
  fillSelect('f-relation', RELATIONS);
  fillSelect('f-priority', PRIORITIES);

  setVal('f-name', d.name);
  if (EL['f-type'])     EL['f-type'].value     = d.type_id || '';
  if (EL['f-status'])   EL['f-status'].value   = d.status;
  if (EL['f-relation']) EL['f-relation'].value = d.relation;
  if (EL['f-priority']) EL['f-priority'].value = d.priority;

  setVal('f-address',  d.address);
  setVal('f-postcode', d.postcode);
  setVal('f-city',     d.city);
  setVal('f-region',   d.region);
  setVal('f-lat',      d.lat  ?? '');
  setVal('f-lng',      d.lng  ?? '');

  setVal('f-contact',  d.contact_name);
  setVal('f-role',     d.contact_role);
  setVal('f-email',    d.email);
  setVal('f-phone',    d.phone);
  setVal('f-website',  d.website);

  setVal('f-capacity', d.capacity ?? '');
  setVal('f-fee',      d.fee);
  setVal('f-tech',     d.tech);
  setVal('f-access',   d.access);

  setVal('f-next-step', d.next_step);
  setVal('f-next-date', d.next_date);
  setVal('f-notes',     d.notes);

  renderTags();
  renderRatings();
  setTxt('ui-sheet-msg', '');
}

/* ─── Tags ─── */
function renderTags(){
  const box = EL['ui-tags-list'];
  if (!box) return;
  box.innerHTML = (draft?.tags || []).map((t, i) =>
    `<span class="chip">${esc(t)}<button class="chip-x" data-tag="${i}">×</button></span>`
  ).join('') || '<span class="muted">Aucun tag</span>';
}

function addTag(){
  if (!draft) return;
  const raw = getVal('f-tags-input').trim().toLowerCase();
  if (!raw) return;
  for (const t of raw.split(',').map(s => s.trim()).filter(Boolean)){
    if (!draft.tags.includes(t) && draft.tags.length < 20) draft.tags.push(t);
  }
  setVal('f-tags-input', '');
  renderTags();
}

/* ─── Notations ─── */
function renderRatings(){
  const box = EL['ui-ratings'];
  if (!box) return;

  if (!S.crit.length){
    box.innerHTML = '<p class="muted">Aucun critère défini. Réglages → Critères.</p>';
    setTxt('ui-score', '—');
    return;
  }

  box.innerHTML = S.crit.map(c => {
    const v = draft?.ratings?.[c.id] || 0;
    const stars = Array.from({ length: STARS_MAX }, (_, i) =>
      `<button class="star${i < v ? ' is-active' : ''}"
               data-crit="${c.id}" data-val="${i+1}"
               title="${i+1}/${STARS_MAX}">★</button>`
    ).join('');
    return `<div class="rating">
      <div class="rating-head">
        <span class="rating-lbl">${esc(c.label)}</span>
        <span class="rating-w">×${c.weight}</span>
      </div>
      <div class="rating-stars">${stars}
        ${v ? `<button class="star-clr" data-crit="${c.id}" data-val="0">↺</button>` : ''}
      </div>
    </div>`;
  }).join('');

  updateScore();
}

function updateScore(){
  const el = EL['ui-score'];
  if (!el || !draft) return;
  const sc  = computeScore(draft.ratings, S.crit);
  const cov = scoreCoverage(draft.ratings, S.crit);
  el.textContent = sc === null ? '—' : sc;
  el.className = 'score-big badge ' + scoreBadge(sc);
  el.title = `${cov.done}/${cov.total} critères notés`;
}

/* ─── Journal ─── */
function renderLogs(){
  const box = EL['ui-logs'];
  if (!box) return;
  if (!draft?.id){
    box.innerHTML = '<p class="muted">Enregistre le lieu pour ajouter des notes.</p>';
    return;
  }
  box.innerHTML = S.logs.length
    ? S.logs.map(l => `<div class="log">
        <div class="log-date">${esc(String(l.created_at).slice(0,16).replace('T',' '))}
          <button class="log-x" data-log="${l.id}">×</button></div>
        <div class="log-body">${esc(l.body)}</div>
      </div>`).join('')
    : '<p class="muted">Aucune note.</p>';
}

/* ─── Lecture du formulaire ─── */
function readForm(){
  draft.name         = getVal('f-name');
  draft.type_id      = getVal('f-type') || null;
  draft.status       = getVal('f-status');
  draft.relation     = getVal('f-relation');
  draft.priority     = Number(getVal('f-priority')) || 2;

  draft.address      = getVal('f-address');
  draft.postcode     = getVal('f-postcode');
  draft.city         = getVal('f-city');
  draft.region       = getVal('f-region');
  draft.lat          = getVal('f-lat') === '' ? null : Number(getVal('f-lat'));
  draft.lng          = getVal('f-lng') === '' ? null : Number(getVal('f-lng'));

  draft.contact_name = getVal('f-contact');
  draft.contact_role = getVal('f-role');
  draft.email        = getVal('f-email');
  draft.phone        = getVal('f-phone');
  draft.website      = getVal('f-website');

  draft.capacity     = getVal('f-capacity') === '' ? null : Number(getVal('f-capacity'));
  draft.fee          = getVal('f-fee');
  draft.tech         = getVal('f-tech');
  draft.access       = getVal('f-access');

  draft.next_step    = getVal('f-next-step');
  draft.next_date    = getVal('f-next-date');
  draft.notes        = getVal('f-notes');
}

/* ─── Géocodage (Nominatim) ─── */
async function geocode(){
  readForm();
  const q = [draft.address, draft.postcode, draft.city, 'France']
    .filter(Boolean).join(', ');
  if (!q || q === 'France'){ return setTxt('ui-sheet-msg', 'Renseigne au moins une ville.'); }

  setTxt('ui-sheet-msg', 'Recherche des coordonnées…');
  try{
    const r = await fetch(
      'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' +
      encodeURIComponent(q)
    );
    const j = await r.json();
    if (!j.length){ return setTxt('ui-sheet-msg', 'Adresse introuvable.'); }
    draft.lat = Number(j[0].lat);
    draft.lng = Number(j[0].lon);
    setVal('f-lat', draft.lat.toFixed(6));
    setVal('f-lng', draft.lng.toFixed(6));
    setTxt('ui-sheet-msg', '✓ Coordonnées trouvées.');
  }catch(e){
    setTxt('ui-sheet-msg', 'Échec du géocodage (réseau ?).');
  }
}

/* ─── Enregistrement ─── */
async function save(){
  if (!draft) return;
  readForm();
  if (!draft.name.trim()){ return setTxt('ui-sheet-msg', 'Le nom est obligatoire.'); }

  const btn = EL['btn-save'];
  if (btn) btn.disabled = true;
  setTxt('ui-sheet-msg', 'Enregistrement…');
  try{
    const saved = await data.savePlace(draft);
    draft.id = saved.id;
    S.selId  = saved.id;
    ok('Lieu enregistré');
    setTxt('ui-sheet-msg', '');
    fillForm();
    renderLogs();
    afterSave();
  }catch(e){
    console.error(e);
    setTxt('ui-sheet-msg', 'Erreur : ' + (e.message || 'inconnue'));
    err('Échec de l\'enregistrement');
  }finally{
    if (btn) btn.disabled = false;
  }
}

async function remove(){
  if (!draft?.id) return;
  const okDel = await confirmBox(`Supprimer « ${draft.name} » définitivement ?`);
  if (!okDel) return;
  try{
    await data.deletePlace(draft.id);
    ok('Lieu supprimé');
    close();
    afterSave();
  }catch(e){ err('Suppression impossible'); }
}

async function duplicate(){
  if (!draft?.id) return;
  readForm();
  const copy = { ...structuredClone(draft), id:null, name: draft.name + ' (copie)' };
  try{
    const saved = await data.savePlace(copy);
    ok('Lieu dupliqué');
    afterSave();
    await open(saved.id);
  }catch(e){ err('Duplication impossible'); }
}

/* ─── Init ─── */
export function initSheet(onChange){
  afterSave = onChange || afterSave;

  on('btn-sheet-close', 'click', close);
  on('btn-save',        'click', save);
  on('btn-del',         'click', remove);
  on('btn-dup',         'click', duplicate);
  on('btn-geocode',     'click', geocode);

  on('btn-fav', 'click', async () => {
    if (!draft) return;
    draft.favorite = !draft.favorite;
    const b = EL['btn-fav'];
    if (b){
      b.textContent = draft.favorite ? '★' : '☆';
      b.classList.toggle('is-active', draft.favorite);
    }
    if (draft.id){
      try{ await data.toggleFav(draft.id); afterSave(); }
      catch(e){ err('Échec'); }
    }
  });

  on('f-tags-input', 'keydown', (e) => {
    if (e.key === 'Enter' || e.key === ','){ e.preventDefault(); addTag(); }
  });
  on('f-tags-input', 'blur', addTag);

  EL['ui-tags-list']?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tag]');
    if (!b || !draft) return;
    draft.tags.splice(Number(b.dataset.tag), 1);
    renderTags();
  });

  EL['ui-ratings']?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-crit]');
    if (!b || !draft) return;
    const id = b.dataset.crit, v = Number(b.dataset.val);
    draft.ratings = draft.ratings || {};
    if (v === 0) delete draft.ratings[id];
    else draft.ratings[id] = v;
    renderRatings();
  });

  on('btn-log-add', 'click', async () => {
    if (!draft?.id) return setTxt('ui-sheet-msg', 'Enregistre d\'abord le lieu.');
    const body = getVal('f-log-input').trim();
    if (!body) return;
    try{
      await data.addLog(draft.id, body);
      setVal('f-log-input', '');
      renderLogs();
    }catch(e){ err('Note non ajoutée'); }
  });

  EL['ui-logs']?.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-log]');
    if (!b) return;
    try{ await data.deleteLog(b.dataset.log); renderLogs(); }
    catch(e){ err('Suppression impossible'); }
  });

  document.addEventListener('keydown', (e) => {
    const sh = EL['sheet'];
    if (e.key === 'Escape' && sh && !sh.hidden) close();
  });
}
