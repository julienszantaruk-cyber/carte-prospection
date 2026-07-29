/* ═══════════════════════════════════════════════════════
   16 · IO — export CSV / JSON, import JSON
   ═══════════════════════════════════════════════════════ */

import { S, typeById } from './state.js';
import { EL, on } from './dom.js';
import { COLS } from './config.js';
import * as data from './data.js';
import { ok, err, warn, confirmBox } from './toast.js';

let afterImport = () => {};

/* ─── Téléchargement ─── */
function download(filename, content, mime){
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

/* ─── Export CSV ─── */
function csvCell(v){
  if (v === null || v === undefined) return '';
  const s = Array.isArray(v) ? v.join('|') : String(v);
  return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function exportCsv(){
  const rows = S.view;
  if (!rows.length) return warn('Rien à exporter (filtre trop restrictif ?).');

  const keys = COLS.map(c => c.k);
  const head = COLS.map(c => c.l).join(';');

  const body = rows.map(p => keys.map(k => {
    if (k === 'type') return csvCell(typeById(p.type_id)?.label || '');
    return csvCell(p[k]);
  }).join(';')).join('\n');

  // BOM pour qu'Excel reconnaisse l'UTF-8
  download(`prospection-${stamp()}.csv`, '\uFEFF' + head + '\n' + body, 'text/csv');
  ok(`${rows.length} lieu(x) exporté(s) en CSV`);
}

/* ─── Export JSON complet ─── */
function exportJson(){
  const payload = {
    format  : 'prospection-v1',
    exported: new Date().toISOString(),
    types   : S.types,
    criteria: S.crit,
    places  : S.places
  };
  download(`prospection-${stamp()}.json`,
           JSON.stringify(payload, null, 2), 'application/json');
  ok(`${S.places.length} lieu(x) exporté(s) en JSON`);
}

/* ─── Import JSON ─── */
async function importJson(file){
  let payload;
  try{
    payload = JSON.parse(await file.text());
  }catch(e){
    return err('Fichier JSON illisible.');
  }

  if (payload.format !== 'prospection-v1'){
    return err('Format non reconnu (attendu : prospection-v1).');
  }

  const nPlaces = (payload.places || []).length;
  const nTypes  = (payload.types  || []).length;
  const nCrit   = (payload.criteria || []).length;

  const go = await confirmBox(
    `Importer ${nPlaces} lieu(x), ${nTypes} type(s) et ${nCrit} critère(s) ?\n\n` +
    `Les lieux portant le même nom seront ajoutés en double : ` +
    `l'import n'écrase rien.`
  );
  if (!go) return;

  let done = 0, failed = 0;

  /* 1. Types — on garde une table de correspondance ancien id → nouveau id */
  const typeMap = new Map();
  for (const t of (payload.types || [])){
    try{
      const existing = S.types.find(x => x.label === t.label);
      if (existing){ typeMap.set(t.id, existing.id); continue; }
      const saved = await data.saveType({
        label:t.label, emoji:t.emoji, color:t.color, sort_order:t.sort_order
      });
      typeMap.set(t.id, saved.id);
    }catch(e){ failed++; }
  }

  /* 2. Critères — même logique */
  const critMap = new Map();
  for (const c of (payload.criteria || [])){
    try{
      const existing = S.crit.find(x => x.label === c.label);
      if (existing){ critMap.set(c.id, existing.id); continue; }
      const saved = await data.saveCriterion({
        label:c.label, weight:c.weight, sort_order:c.sort_order
      });
      critMap.set(c.id, saved.id);
    }catch(e){ failed++; }
  }

  /* 3. Lieux — on remappe type_id et les clés de ratings */
  for (const p of (payload.places || [])){
    try{
      const ratings = {};
      for (const [oldId, val] of Object.entries(p.ratings || {})){
        const newId = critMap.get(oldId) || oldId;
        ratings[newId] = val;
      }
      await data.savePlace({
        ...p,
        id      : null,                                  // toujours une création
        type_id : typeMap.get(p.type_id) || null,
        ratings
      });
      done++;
    }catch(e){
      console.error('Import — lieu ignoré :', p?.name, e);
      failed++;
    }
  }

  await afterImport();

  if (failed) warn(`${done} importé(s), ${failed} en échec (voir console).`);
  else        ok(`${done} lieu(x) importé(s).`);
}

/* ─── Init ─── */
export function initIo(onImport){
  afterImport = onImport || afterImport;

  on('top-btn-csv',  'click', exportCsv);
  on('top-btn-json', 'click', exportJson);

  on('top-btn-import', 'click', () => EL['io-file']?.click());

  on('io-file', 'change', async (e) => {
    const file = e.target.files?.[0];
    if (file) await importJson(file);
    e.target.value = '';   // permet de réimporter le même fichier
  });
}
