/* ═══════════════════════════════════════════════════════
   15 · SETTINGS — types de lieux, critères, compte
   Aligné sur les tables public.place_types et public.criteria
   ═══════════════════════════════════════════════════════ */

import { S } from './state.js';
import { EL, on, esc, setVal, getVal } from './dom.js';
import * as data from './data.js';
import { ok, err, info, confirmBox } from './toast.js';

let afterChange = () => {};

/* ═══ Ouverture / fermeture du panneau ═══ */

export function openSettings(){
  const p = EL['ui-settings'];
  if (!p) return;
  p.hidden = false;
  p.classList.add('is-open');
  renderTypes();
  renderCriteria();
  renderAccount();
}

export function closeSettings(){
  const p = EL['ui-settings'];
  if (!p) return;
  p.classList.remove('is-open');
  setTimeout(() => { p.hidden = true; }, 180);
}

export function toggleSettings(){
  const p = EL['ui-settings'];
  if (!p) return;
  if (p.hidden) openSettings();
  else closeSettings();
}

/* ═══ Menu déroulant (le bug du `...` était ici) ═══ */

let menuOutsideBound = false;

export function toggleMenu(force){
  const m = EL['ui-menu'];
  const b = EL['btn-menu'];
  if (!m) return;

  const willOpen = (typeof force === 'boolean') ? force : m.hidden;

  m.hidden = !willOpen;
  m.classList.toggle('is-open', willOpen);
  b?.setAttribute('aria-expanded', String(willOpen));

  /* Le listener global n'est attaché qu'une seule fois, jamais dans une
     closure recréée à chaque ouverture (sinon fuite de handlers). */
  if (willOpen && !menuOutsideBound){
    menuOutsideBound = true;
    document.addEventListener('click', onOutsideClick, true);
    document.addEventListener('keydown', onMenuKey, true);
  }
}

function onOutsideClick(e){
  const m = EL['ui-menu'];
  const b = EL['btn-menu'];
  if (!m || m.hidden) return;
  if (m.contains(e.target)) return;
  if (b && (e.target === b || b.contains(e.target))) return;
  toggleMenu(false);
}

function onMenuKey(e){
  const m = EL['ui-menu'];
  if (!m || m.hidden) return;
  if (e.key === 'Escape'){
    e.preventDefault();
    toggleMenu(false);
    EL['btn-menu']?.focus();
  }
}

/* ═══ Types de lieux ═══ */

const DEFAULT_EMOJI = '📍';
const DEFAULT_COLOR = '#7c9cff';

function renderTypes(){
  const box = EL['ui-types'];
  if (!box) return;

  const rows = S.types.map(t => `
    <div class="set-row" data-type="${t.id}">
      <input class="set-emoji" type="text" maxlength="4"
             value="${esc(t.emoji || DEFAULT_EMOJI)}" aria-label="Emoji du type">
      <input class="set-color" type="color"
             value="${esc(t.color || DEFAULT_COLOR)}" aria-label="Couleur du type">
      <input class="set-label" type="text"
             value="${esc(t.label || '')}" placeholder="Nom du type"
             aria-label="Nom du type">
      <input class="set-num" type="number" step="1"
             value="${Number(t.sort_order ?? 0)}" aria-label="Ordre d'affichage">
      <button type="button" class="set-save" data-act="save-type"
              title="Enregistrer">✓</button>
      <button type="button" class="set-del" data-act="del-type"
              title="Supprimer">×</button>
    </div>`).join('');

  box.innerHTML = rows || '<p class="muted">Aucun type. Ajoute-en un ci-dessous.</p>';
}

async function addType(){
  const label = getVal('f-new-type').trim();
  if (!label) return err('Donne un nom au type.');
  try {
    await data.saveType({
      label,
      emoji: DEFAULT_EMOJI,
      color: DEFAULT_COLOR,
      sort_order: S.types.length
    });
    setVal('f-new-type', '');
    renderTypes();
    afterChange();
    ok('Type ajouté');
  } catch (e) {
    console.error(e);
    err('Ajout impossible');
  }
}

async function saveTypeRow(row){
  const id = row.dataset.type;
  const t  = S.types.find(x => x.id === id);
  if (!t) return;

  const label = row.querySelector('.set-label')?.value.trim() || '';
  if (!label) return err('Le nom ne peut pas être vide.');

  try {
    await data.saveType({
      id,
      label,
      emoji:      row.querySelector('.set-emoji')?.value.trim() || DEFAULT_EMOJI,
      color:      row.querySelector('.set-color')?.value || DEFAULT_COLOR,
      sort_order: Number(row.querySelector('.set-num')?.value) || 0
    });
    renderTypes();
    afterChange();
    ok('Type mis à jour');
  } catch (e) {
    console.error(e);
    err('Mise à jour impossible');
  }
}

async function delType(row){
  const id = row.dataset.type;
  const t  = S.types.find(x => x.id === id);
  if (!t) return;

  const used = S.places.filter(p => p.type_id === id).length;
  const msg  = used
    ? `« ${t.label} » est utilisé par ${used} lieu(x). Ils passeront à « sans type ». Continuer ?`
    : `Supprimer le type « ${t.label} » ?`;
  if (!await confirmBox(msg)) return;

  try {
    await data.deleteType(id);
    renderTypes();
    afterChange();
    ok('Type supprimé');
  } catch (e) {
    console.error(e);
    err('Suppression impossible');
  }
}

/* ═══ Critères d'évaluation ═══ */

function renderCriteria(){
  const box = EL['ui-criteria'];
  if (!box) return;

  const rows = S.crit.map(c => `
    <div class="set-row" data-crit="${c.id}">
      <input class="set-label" type="text"
             value="${esc(c.label || '')}" placeholder="Libellé du critère"
             aria-label="Libellé du critère">
      <input class="set-num" type="number" min="0" max="10" step="0.5"
             value="${Number(c.weight ?? 1)}" aria-label="Pondération">
      <input class="set-num" type="number" step="1"
             value="${Number(c.sort_order ?? 0)}" aria-label="Ordre d'affichage">
      <button type="button" class="set-save" data-act="save-crit"
              title="Enregistrer">✓</button>
      <button type="button" class="set-del" data-act="del-crit"
              title="Supprimer">×</button>
    </div>`).join('');

  const total = S.crit.reduce((s, c) => s + (Number(c.weight) || 0), 0);
  box.innerHTML = (rows || '<p class="muted">Aucun critère.</p>')
    + `<p class="muted set-total">Somme des pondérations : ${total}</p>`;
}

/** Clé technique stable dérivée du libellé (colonne criteria.key). */
function slug(s){
  return (s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'critere';
}

async function addCriterion(){
  const label = getVal('f-new-crit').trim();
  if (!label) return err('Donne un libellé au critère.');

  let key = slug(label), n = 2;
  while (S.crit.some(c => c.key === key)) key = slug(label) + '_' + n++;

  try {
    await data.saveCriterion({
      key, label, weight: 1, sort_order: S.crit.length
    });
    setVal('f-new-crit', '');
    renderCriteria();
    afterChange();
    ok('Critère ajouté');
  } catch (e) {
    console.error(e);
    err('Ajout impossible');
  }
}

async function saveCritRow(row){
  const id = row.dataset.crit;
  const c  = S.crit.find(x => x.id === id);
  if (!c) return;

  const nums  = row.querySelectorAll('.set-num');
  const label = row.querySelector('.set-label')?.value.trim() || '';
  if (!label) return err('Le libellé ne peut pas être vide.');

  const weight = Number(nums[0]?.value);
  if (!Number.isFinite(weight) || weight < 0){
    return err('La pondération doit être un nombre positif.');
  }

  try {
    await data.saveCriterion({
      id, key: c.key, label, weight,
      sort_order: Number(nums[1]?.value) || 0
    });
    renderCriteria();
    afterChange();
    ok('Critère mis à jour');
  } catch (e) {
    console.error(e);
    err('Mise à jour impossible');
  }
}

async function delCrit(row){
  const id = row.dataset.crit;
  const c  = S.crit.find(x => x.id === id);
  if (!c) return;

  const rated = S.places.filter(p => p.ratings && p.ratings[id] != null).length;
  const msg   = rated
    ? `« ${c.label} » est noté sur ${rated} lieu(x). Ces notes seront perdues et les scores recalculés. Continuer ?`
    : `Supprimer le critère « ${c.label} » ?`;
  if (!await confirmBox(msg)) return;

  try {
    await data.deleteCriterion(id);
    renderCriteria();
    afterChange();
    ok('Critère supprimé');
  } catch (e) {
    console.error(e);
    err('Suppression impossible');
  }
}

/* ═══ Compte ═══ */

function renderAccount(){
  const box = EL['ui-account'];
  if (!box) return;
  const mail = S.user?.email || '—';
  box.innerHTML = `
    <p class="muted">Connecté en tant que <strong>${esc(mail)}</strong></p>
    <p class="muted">${S.places.length} lieu(x) · ${S.types.length} type(s) · ${S.crit.length} critère(s)</p>`;
}

/* ═══ Init ═══ */

export function initSettings(onChange){
  afterChange = onChange || afterChange;

  on('btn-settings',       'click', () => { toggleMenu(false); openSettings(); });
  on('btn-settings-close', 'click', closeSettings);

  on('btn-menu', 'click', e => { e.stopPropagation(); toggleMenu(); });

  on('btn-new-type', 'click', addType);
  on('f-new-type',   'keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); addType(); } });

  on('btn-new-crit', 'click', addCriterion);
  on('f-new-crit',   'keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); addCriterion(); } });

  /* Délégation : types */
  EL['ui-types']?.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const row = b.closest('[data-type]');
    if (!row) return;
    if (b.dataset.act === 'save-type') saveTypeRow(row);
    if (b.dataset.act === 'del-type')  delType(row);
  });

  EL['ui-types']?.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const row = e.target.closest('[data-type]');
    if (row){ e.preventDefault(); saveTypeRow(row); }
  });

  /* Délégation : critères */
  EL['ui-criteria']?.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const row = b.closest('[data-crit]');
    if (!row) return;
    if (b.dataset.act === 'save-crit') saveCritRow(row);
    if (b.dataset.act === 'del-crit')  delCrit(row);
  });

  EL['ui-criteria']?.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const row = e.target.closest('[data-crit]');
    if (row){ e.preventDefault(); saveCritRow(row); }
  });

  /* Échap ferme le panneau de réglages */
  document.addEventListener('keydown', e => {
    const p = EL['ui-settings'];
    if (e.key === 'Escape' && p && !p.hidden) closeSettings();
  });
}

/* Rafraîchissement externe (après un rechargement des données) */
export function refreshSettings(){
  const p = EL['ui-settings'];
  if (!p || p.hidden) return;
  renderTypes();
  renderCriteria();
  renderAccount();
}
