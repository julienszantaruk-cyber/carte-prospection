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
  EL['sheet'].hidden = false;
  EL['sheet'].classList.add('is-open');

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
  EL['sheet'].classList.remove('is-open');
  setTimeout(() => { EL['sheet'].hidden = true; }, 180);
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

  setTxt('sheet-title', d.id ? d.name || 'Sans nom' : 'Nouveau lieu');
  const t = typeById(d.type_id);
  setTxt('sheet-sub', [t?.label, d.city].filter(Boolean).join(' · ') || 'À compléter');

  EL['sheet-btn-fav'].textContent = d.favorite ? '★' : '☆';
  EL['sheet-btn-fav'].classList.toggle('is-on', !!d.favorite);
  EL['sheet-btn-del'].hidden = !d.id;

  fillSelect('p-type',     S.types.map(x => ({ v:x.id, l:x.emoji + ' ' + x.label })));
  fillSelect('p-status',   STATUSES);
  fillSelect('p-relation', RELATIONS);
  fillSelect('p-prio',     PRIORITIES);

  setVal('p-name', d.name);
  if (EL['p-type'])     EL['p-type'].value     = d.type_id || '';
  if (EL['p-status'])   EL['p-status'].value   = d.status;
  if (EL['p-relation']) EL['p-relation'].value = d.relation;
  if (EL['p-prio'])     EL['p-prio'].value     = d.priority;

  setVal('p-address',  d.address);
  setVal('p-postcode', d.postcode);
  setVal('p-city',     d.city);
  setVal('p-region',   d.region);
  setVal('p-lat',      d.lat  ?? '');
  setVal('p-lng',      d.lng  ?? '');

  setVal('p-contact',  d.contact_name);
  setVal('p-role',     d.contact_role);
  setVal('p-email',    d.email);
  setVal('p-phone',    d.phone);
  setVal('p-website',  d.website);

  setVal('p-capacity', d.capacity ?? '');
  setVal('p-fee',      d.fee);
  setVal('p-tech',     d.tech);
  setVal('p-access',   d.access);

  setVal('p-next-step', d.next_step);
  setVal('p-next-date', d.next_date);
  setVal('p-notes',     d.notes);

  renderTags();
  renderRatings();
  setTxt('sheet-msg', '');
}

/* ─── Tags ─── */
function renderTags(){
  EL['p-tags-list'].innerHTML = (draft.tags || []).map((t, i) =>
    `<span class="chip">${esc(t)}<button class="chip-x" data-tag="${i}">×</button></span>`
  ).join('') || '<span class="muted">Aucun tag</span>';
}

function addTag(){
  const raw = getVal('p-tags-input').trim().toLowerCase();
  if (!raw) return;
  for (const t of raw.split(',').map(s => s.trim()).filter(Boolean)){
    if (!draft.tags.includes(t) && draft.tags.length < 20) draft.tags.push(t);
  }
  setVal('p-tags-input', '');
  renderTags();
}

/* ─── Notations ─── */
function renderRatings(){
  const box = EL['p-ratings'];
  if (!S.crit.length){
    box.innerHTML = '<p class="muted">Aucun critère défini. Réglages → Critères.</p>';
    setTxt('p-score', '—');
    return;
  }

  box.innerHTML = S.crit.map(c => {
    const v = draft.ratings?.[c.id] || 0;
    const stars = Array.from({ length: STARS_MAX }, (_, i) =>
      `<button class="star${i < v ? ' is-on' : ''}"
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
  const sc = computeScore(draft.ratings, S.crit);
  const cov = scoreCoverage(draft.ratings, S.crit);
  const el = EL['p-score'];
  el.textContent = sc === null ? '—' : sc;
  el.className = 'score-big badge ' + scoreBadge(sc);
  el.title = `${cov.done}/${cov.total} critères notés`;
}

/* ─── Journal ─── */
function renderLogs(){
  const box = EL['p-logs'];
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
  draft.name         = getVal('p-name');
  draft.type_id      = getVal('p-type') || null;
  draft.status       = getVal('p-status');
  draft.relation     = getVal('p-relation');
  draft.priority     = Number(getVal('p-prio')) || 2;

  draft.address      = getVal('p-address');
  draft.postcode     = getVal('p-postcode');
  draft.city         = getVal('p-city');
  draft.region       = getVal('p-region');
  draft.lat          = getVal('p-lat')  === '' ? null : Number(getVal('p-lat'));
  draft.lng          = getVal('p-lng')  === '' ? null : Number(getVal('p-lng'));

  draft.contact_name = getVal('p-contact');
  draft.contact_role = getVal('p-role');
  draft.email        = getVal('p-email');
  draft.phone        = getVal('p-phone');
  draft.website      = getVal('p-website');

  draft.capacity     = getVal('p-capacity') === '' ? null : Number(getVal('p-capacity'));
  draft.fee          = getVal('p-fee');
  draft.tech         = getVal('p-tech');
  draft.access       = getVal('p-access');

  draft.next_step    = getVal('p-next-step');
  draft.next_date    = getVal('p-next-date');
  draft.notes        = getVal('p-notes');
}

/* ─── Géocodage (Nominatim) ─── */
async function geocode(){
  readForm();
  const q = [draft.address, draft.postcode, draft.city, 'France']
    .filter(Boolean).join(', ');
  if (!q || q === 'France'){ return setTxt('sheet-msg', 'Renseigne au moins une ville.'); }

  setTxt('sheet-msg', 'Recherche des coordonnées…');
  try{
    const r = await fetch(
      'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' +
      encodeURIComponent(q)
    );
    const j = await r.json();
    if (!j.length){ return setTxt('sheet-msg', 'Adresse introuvable.'); }
    draft.lat = Number(j[0].lat);
    draft.lng = Number(j[0].lon);
    setVal('p-lat', draft.lat.toFixed(6));
    setVal('p-lng', draft.lng.toFixed(6));
    setTxt('sheet-msg', '✓ Coordonnées trouvées.');
  }catch(e){
    setTxt('sheet-msg', 'Échec du géocodage (réseau ?).');
  }
}

/* ─── Enregistrement ─── */
async function save(){
  readForm();
  if (!draft.name.trim()){ return setTxt('sheet-msg', 'Le nom est obligatoire.'); }

  EL['sheet-btn-save'].disabled = true;
  setTxt('sheet-msg', 'Enregistrement…');
  try{
    const saved = await data.savePlace(draft);
    draft.id = saved.id;
    S.selId  = saved.id;
    ok('Lieu enregistré');
    setTxt('sheet-msg', '');
    fillForm();
    renderLogs();
    afterSave();
  }catch(e){
    console.error(e);
    setTxt('sheet-msg', 'Erreur : ' + (e.message || 'inconnue'));
    err('Échec de l\'enregistrement');
  }finally{
    EL['sheet-btn-save'].disabled = false;
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

/* ─── Init ─── */
export function initSheet(onChange){
  afterSave = onChange || afterSave;

  on('sheet-btn-close', 'click', close);
  on('sheet-btn-save',  'click', save);
  on('sheet-btn-del',   'click', remove);
  on('p-btn-geo',       'click', geocode);

  on('sheet-btn-fav', 'click', async () => {
    if (!draft) return;
    draft.favorite = !draft.favorite;
    EL['sheet-btn-fav'].textContent = draft.favorite ? '★' : '☆';
    EL['sheet-btn-fav'].classList.toggle('is-on', draft.favorite);
    if (draft.id){
      try{ await data.toggleFav(draft.id); afterSave(); }
      catch(e){ err('Échec'); }
    }
  });

  on('p-tags-input', 'keydown', (e) => {
    if (e.key === 'Enter' || e.key === ','){ e.preventDefault(); addTag(); }
  });
  on('p-tags-input', 'blur', addTag);

  EL['p-tags-list']?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tag]');
    if (!b) return;
    draft.tags.splice(Number(b.dataset.tag), 1);
    renderTags();
  });

  EL['p-ratings']?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-crit]');
    if (!b) return;
    const id = b.dataset.crit, v = Number(b.dataset.val);
    draft.ratings = draft.ratings || {};
    if (v === 0) delete draft.ratings[id];
    else draft.ratings[id] = v;
    renderRatings();
  });

  on('p-log-add', 'click', async () => {
    if (!draft?.id) return setTxt('sheet-msg', 'Enregistre d\'abord le lieu.');
    const body = getVal('p-log-input').trim();
    if (!body) return;
    try{
      await data.addLog(draft.id, body);
      setVal('p-log-input', '');
      renderLogs();
    }catch(e){ err('Note non ajoutée'); }
  });

  EL['p-logs']?.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-log]');
    if (!b) return;
    try{ await data.deleteLog(b.dataset.log); renderLogs(); }
    catch(e){ err('Suppression impossible'); }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !EL['sheet'].hidden) close();
  });
}
