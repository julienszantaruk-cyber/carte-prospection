/* ═══════════════════════════════════════════════════════
   3 · DOM — accès centralisé, vérifié au démarrage
   ═══════════════════════════════════════════════════════ */

/* Liste EXHAUSTIVE des ids attendus dans index.html.
   Si tu ajoutes un id au HTML, ajoute-le ici.
   Si tu supprimes un bloc HTML, retire-le d'ici. */
export const REQUIRED_IDS = [
  // auth-
  'auth-view','auth-form','auth-email','auth-pass','auth-submit','auth-msg',
  // ui-
  'ui-app','ui-tabs','ui-user-email','ui-btn-logout','ui-btn-settings',
  'ui-settings-menu','ui-toasts',
  // tab- / view-
  'tab-map','tab-table','tab-dash',
  'view-map','view-table','view-dash',
  // side-
  'side-search','side-btn-clear','side-presets','side-btn-filters',
  'side-sort','side-filters','side-count','side-list','side-btn-new',
  // f- (filtres)
  'f-type','f-status','f-relation','f-prio','f-score-min','f-score-max',
  'f-region','f-city','f-tags','f-fav','f-late','f-reset',
  // map-
  'map-canvas','map-btn-fit','map-btn-cluster',
  // tbl-
  'tbl-head','tbl-body',
  // dash-
  'dash-kpis','dash-by-type','dash-by-status','dash-by-region','dash-top',
  // sheet-
  'sheet','sheet-title','sheet-sub','sheet-btn-fav','sheet-btn-del',
  'sheet-btn-close','sheet-body','sheet-btn-save','sheet-msg',
  // p- (champs de la fiche)
  'p-name','p-type','p-status','p-relation','p-prio',
  'p-address','p-postcode','p-city','p-region','p-lat','p-lng','p-btn-geo',
  'p-contact','p-role','p-email','p-phone','p-website',
  'p-capacity','p-fee','p-tech','p-access',
  'p-tags-input','p-tags-list',
  'p-next-step','p-next-date','p-notes',
  'p-score','p-ratings','p-log-input','p-log-add','p-logs',
  // mod-
  'mod-types','mod-types-list','mod-types-add','mod-types-close',
  'mod-crit','mod-crit-list','mod-crit-add','mod-crit-close',
  'mod-cols','mod-cols-list','mod-cols-close',
  'mod-io','mod-io-close','mod-io-export','mod-io-import','mod-io-file',
  'mod-io-report','mod-io-recalc',
  'mod-confirm','mod-confirm-text','mod-confirm-ok','mod-confirm-cancel',
  // btn- (menu réglages)
  'btn-types','btn-criteria','btn-cols','btn-io'
];

export const EL = {};

/** Remplit EL et vérifie que rien ne manque. */
export function assertDom(){
  const missing = [];
  for (const id of REQUIRED_IDS){
    const node = document.getElementById(id);
    if (node) EL[id] = node;
    else missing.push(id);
  }
  if (missing.length){
    console.error(
      '%c[assertDom] ids manquants dans index.html :',
      'color:#f87171;font-weight:700',
      missing
    );
    return false;
  }
  console.info(
    `%c[assertDom] ✓ ${REQUIRED_IDS.length} ids trouvés`,
    'color:#34d399'
  );
  return true;
}

/** Écouteur sûr : ne plante pas si l'élément est absent. */
export function on(id, evt, fn, opts){
  const node = EL[id] || document.getElementById(id);
  if (!node){
    console.warn(`[on] "${id}" introuvable → ${evt} ignoré`);
    return;
  }
  node.addEventListener(evt, fn, opts);
}

/* ─── Raccourcis de manipulation ─── */
export const show = id => { (EL[id])?.removeAttribute('hidden'); };
export const hide = id => { (EL[id])?.setAttribute('hidden',''); };
export const setTxt = (id, v) => { if (EL[id]) EL[id].textContent = v ?? ''; };
export const setVal = (id, v) => { if (EL[id]) EL[id].value = v ?? ''; };
export const getVal = id => EL[id]?.value ?? '';
export const setHtml = (id, h) => { if (EL[id]) EL[id].innerHTML = h; };

/** Peuple un <select> depuis [{v,l}] ou [{id,label}]. */
export function fillSelect(id, items, { empty=null, keep=false } = {}){
  const sel = EL[id];
  if (!sel) return;
  const prev = keep ? sel.value : null;
  sel.innerHTML = '';
  if (empty !== null){
    const o = document.createElement('option');
    o.value = ''; o.textContent = empty;
    sel.appendChild(o);
  }
  for (const it of items){
    const o = document.createElement('option');
    o.value = it.v ?? it.id;
    o.textContent = it.l ?? it.label;
    sel.appendChild(o);
  }
  if (prev) sel.value = prev;
}

/** Échappe le HTML — à utiliser partout où on injecte du texte. */
export function esc(s){
  const MAP = {
    '\u0026': '\u0026amp;',    //  &  →  &
    '\u003C': '\u0026lt;',     //  <  →  <
    '\u003E': '\u0026gt;',     //  >  →  >
    '\u0022': '\u0026quot;',   //  "  →  "
    '\u0027': '\u0026#39;'     //  '  →  '
  };
  return String(s ?? '').replace(/[\u0026\u003C\u003E\u0022\u0027]/g, c => MAP[c]);
}
