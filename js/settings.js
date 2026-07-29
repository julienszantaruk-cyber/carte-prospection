/* ═══════════════════════════════════════════════════════
   15 · SETTINGS — types, critères, colonnes
   ═══════════════════════════════════════════════════════ */

import { S, saveLocal } from './state.js';
import { EL, on, esc } from './dom.js';
import { COLS } from './config.js';
import * as data from './data.js';
import { ok, err, confirmBox } from './toast.js';

let afterChange = () => {};

const MODALS = ['m-types', 'm-criteria', 'm-cols'];

const openMod  = id => { if (EL[id]) EL[id].hidden = false; };
const closeMod = id => { if (EL[id]) EL[id].hidden = true;  };

/* ─── Types ─── */
function renderTypes(){
  const box = EL['ui-types-list'];
  if (!box) return;
  box.innerHTML = S.types.map(t => `
    <div class="set-row" data-tid="${t.id}">
      <input class="set-emoji" value="${esc(t.emoji)}" maxlength="4" data-k="emoji">
      <input class="set-color" type="color" value="${esc(t.color)}" data-k="color">
      <input class="set-label" value="${esc(t.label)}" data-k="label">
      <input class="set-num" type="number" value="${t.sort_order ?? 0}"
             min="0" max="999" data-k="sort_order" title="Ordre">
      <button class="set-save" data-act="save">✓</button>
      <button class="set-del"  data-act="del">🗑</button>
    </div>`).join('') || '<p class="muted">Aucun type.</p>';
}

async function typesAction(e){
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const row = btn.closest('[data-tid]');
  if (!row) return;
  const id  = row.dataset.tid;

  if (btn.dataset.act === 'del'){
    const used = S.places.filter(p => p.type_id === id).length;
    const q = used
      ? `Ce type est utilisé par ${used} lieu(x). Ils deviendront « non typés ». Continuer ?`
      : 'Supprimer ce type ?';
    if (!await confirmBox(q)) return;
    try{ await data.deleteType(id); renderTypes(); ok('Type supprimé'); afterChange(); }
    catch(e){ err('Suppression impossible'); }
    return;
  }

  const get = k => row.querySelector(`[data-k="${k}"]`).value;
  try{
    await data.saveType({ id, label:get('label'), emoji:get('emoji'),
                          color:get('color'), sort_order:get('sort_order') });
    renderTypes(); ok('Type enregistré'); afterChange();
  }catch(e){ err('Enregistrement échoué'); }
}

/* ─── Critères ─── */
function renderCrit(){
  const box = EL['ui-criteria-list'];
  if (!box) return;
  box.innerHTML = S.crit.map(c => `
    <div class="set-row" data-cid="${c.id}">
      <input class="set-label" value="${esc(c.label)}" data-k="label">
      <input class="set-num" type="number" value="${c.weight}"
             min="1" max="10" data-k="weight" title="Poids 1–10">
      <input class="set-num" type="number" value="${c.sort_order ?? 0}"
             min="0" max="999" data-k="sort_order" title="Ordre">
      <button class="set-save" data-act="save">✓</button>
      <button class="set-del"  data-act="del">🗑</button>
    </div>`).join('') || '<p class="muted">Aucun critère.</p>';
}

async function critAction(e){
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const row = btn.closest('[data-cid]');
  if (!row) return;
  const id  = row.dataset.cid;

  if (btn.dataset.act === 'del'){
    if (!await confirmBox('Supprimer ce critère ? Les scores seront recalculés.')) return;
    try{
      await data.deleteCriterion(id);
      const n = await data.recalcAll();
      renderCrit(); ok(`Critère supprimé · ${n} score(s) recalculé(s)`); afterChange();
    }catch(e){ err('Suppression impossible'); }
    return;
  }

  const get = k => row.querySelector(`[data-k="${k}"]`).value;
  try{
    await data.saveCriterion({ id, label:get('label'),
                               weight:get('weight'), sort_order:get('sort_order') });
    const n = await data.recalcAll();
    renderCrit(); ok(`Enregistré · ${n} score(s) recalculé(s)`); afterChange();
  }catch(e){ err('Enregistrement échoué'); }
}

/* ─── Colonnes ─── */
function renderCols(){
  const box = EL['ui-cols-list'];
  if (!box) return;
  box.innerHTML = COLS.map(c => `
    <label class="set-check">
      <input type="checkbox" data-col="${c.k}"
             ${S.cols.includes(c.k) ? 'checked' : ''}>
      <span>${esc(c.l)}</span>
    </label>`).join('');
}

function colsAction(e){
  const cb = e.target.closest('[data-col]');
  if (!cb) return;
  const k = cb.dataset.col;
  if (cb.checked){
    if (!S.cols.includes(k)) S.cols.push(k);
  } else {
    if (S.cols.length <= 1){
      cb.checked = true;
      return err('Garde au moins une colonne.');
    }
    S.cols = S.cols.filter(x => x !== k);
  }
  // on respecte l'ordre de COLS, pas l'ordre de clic
  S.cols = COLS.filter(c => S.cols.includes(c.k)).map(c => c.k);
  saveLocal();
  afterChange();
}

/* ─── Menu réglages ─── */
function toggleMenu(force){
  const m = EL['ui-settings-menu'];
  if (!m) return;
  m.hidden = (force !== undefined) ? !force : !m.hidden;
}

/* ─── Init ─── */
export function initSettings(onChange){
  afterChange = onChange || afterChange;

  /* Menu déroulant Réglages */
  on('btn-settings', 'click', (e) => { e.stopPropagation(); toggleMenu(); });
  document.addEventListener('click', (e) => {
    const m = EL['ui-settings-menu'];
    if (m && !m.hidden && !m.contains(e.target) && e.target !== EL['btn-settings']){
      toggleMenu(false);
    }
  });

  /* Ouverture des modales */
  on('btn-types',    'click', () => { toggleMenu(false); renderTypes(); openMod('m-types');    });
  on('btn-criteria', 'click', () => { toggleMenu(false); renderCrit();  openMod('m-criteria'); });
  on('btn-cols',     'click', () => { toggleMenu(false); renderCols();  openMod('m-cols');     });

  /* Fermeture : bouton [data-close] + clic sur le fond */
  for (const id of MODALS){
    const mod = EL[id];
    if (!mod) continue;
    mod.addEventListener('click', (e) => {
      if (e.target === mod || e.target.closest('[data-close]')) closeMod(id);
    });
  }

  /* Actions dans les listes */
  EL['ui-types-list']   ?.addEventListener('click',  typesAction);
  EL['ui-criteria-list']?.addEventListener('click',  critAction);
  EL['ui-cols-list']    ?.addEventListener('change', colsAction);

  /* Ajout d'un type */
  on('btn-type-add', 'click', async () => {
    try{
      await data.saveType({
        label      : 'Nouveau type',
        emoji      : '📍',
        color      : '#6366f1',
        sort_order : (S.types.length + 1) * 10
      });
      renderTypes(); ok('Type ajouté'); afterChange();
    }catch(e){ err('Ajout impossible'); }
  });

  /* Ajout d'un critère */
  on('btn-criteria-add', 'click', async () => {
    try{
      await data.saveCriterion({
        label      : 'Nouveau critère',
        weight     : 3,
        sort_order : (S.crit.length + 1) * 10
      });
      const n = await data.recalcAll();
      renderCrit(); ok(`Critère ajouté · ${n} score(s) recalculé(s)`); afterChange();
    }catch(e){ err('Ajout impossible'); }
  });

  /* Recalcul manuel de tous les scores */
  on('btn-recalc', 'click', async () => {
    try{
      const n = await data.recalcAll();
      ok(`${n} score(s) recalculé(s)`); afterChange();
    }catch(e){ err('Recalcul échoué'); }
  });

  /* Fermeture globale à l'Échap */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    toggleMenu(false);
    for (const id of MODALS){
      if (EL[id] && !EL[id].hidden) closeMod(id);
    }
  });
}
