/**
 * dom.js — accès DOM centralisé.
 * SOURCE DE VÉRITÉ : le bloc d'inventaire en tête de index.html.
 * Toute modification d'id se fait là-bas d'abord, ici ensuite.
 */

/* ─── Inventaire, groupé comme dans index.html ─── */
export const REQUIRED_IDS = [
  /* ui-* transverses */
  'ui-toasts',

  /* v-auth */
  'v-auth', 'f-auth-email', 'f-auth-password', 'btn-login', 'ui-auth-msg',

  /* v-app / topbar */
  'v-app',
  'btn-view-map', 'btn-view-table', 'btn-view-dash',
  'btn-new', 'btn-settings', 'ui-user-email', 'btn-logout',

  /* side — recherche & presets */
  'flt-search', 'btn-search-clear',
  'btn-preset-recent', 'btn-preset-top', 'btn-preset-todo', 'btn-preset-fav',
  'btn-filters-toggle', 'ui-filter-count', 'flt-sort',

  /* side — filtres */
  'ui-active-filters',
  'flt-type', 'flt-status', 'flt-relation', 'flt-priority',
  'flt-legal-form', 'flt-governance', 'flt-business-model',
  'flt-score', 'flt-score-val',
  'flt-surface-min', 'flt-surface-max',
  'flt-fav', 'flt-in-view', 'btn-filters-reset',

  /* side — liste */
  'ui-count', 'ui-list', 'ui-empty',

  /* v-map */
  'v-map', 'ui-map', 'btn-fit', 'btn-locate', 'btn-pick',

  /* v-table */
  'v-table', 'ui-table-head', 'ui-table-body', 'ui-table-empty',

  /* v-dash */
  'v-dash',
  'ui-kpi-count', 'ui-kpi-score', 'ui-kpi-surface', 'ui-kpi-rent', 'ui-kpi-fav',
  'ui-dist-type', 'ui-dist-status', 'ui-dist-priority', 'ui-top5',

  /* sheet — en-tête */
  'ui-sheet', 'ui-sheet-title', 'ui-sheet-sub',
  'btn-fav', 'btn-dup', 'btn-del', 'btn-sheet-close',

  /* sheet — identité */
  'f-name', 'f-type', 'f-relation', 'f-description', 'f-opened-year',

  /* sheet — localisation */
  'f-address', 'f-city', 'f-zip', 'f-country', 'f-lat', 'f-lng',
  'btn-geocode', 'btn-pick-map',

  /* sheet — contact */
  'f-contact-name', 'f-email', 'f-phone', 'f-website', 'f-social',
  'f-tags', 'f-tags-input',

  /* sheet — structure juridique */
  'f-legal-form', 'f-governance', 'f-owner', 'f-team-fte', 'f-volunteers',

  /* sheet — économie */
  'f-business-model', 'f-revenue-sources', 'f-revenue-input',
  'f-budget-annual', 'f-subsidy-pct', 'f-funders', 'f-business-notes',

  /* sheet — activité */
  'f-activities', 'f-activities-input',
  'f-studios-count', 'f-residents-year', 'f-audience-year',

  /* sheet — bâti */
  'f-surface-total', 'f-surface-expo', 'f-ceiling-h', 'f-floors', 'f-tenure',
  'f-rent-month', 'f-charges-month', 'f-lease-end',
  'f-features', 'f-features-input', 'f-transport', 'f-constraints',

  /* sheet — évaluation */
  'ui-score-live', 'ui-ratings',
  'f-strengths', 'f-weaknesses', 'f-takeaway',

  /* sheet — suivi */
  'f-status', 'f-priority', 'f-visit-date', 'f-next-date',
  'f-next-action', 'f-links',

  /* sheet — journal */
  'f-log-body', 'btn-log-add', 'ui-logs',

  /* sheet — pied */
  'btn-save',

  /* m-types */
  'm-types', 'set-type-label', 'set-type-emoji', 'set-type-color',
  'btn-type-add', 'ui-types-list',

  /* m-criteria */
  'm-criteria', 'set-criteria-label', 'set-criteria-weight',
  'btn-criteria-add', 'btn-criteria-preset', 'ui-criteria-list', 'btn-recalc',

  /* m-cols */
  'm-cols', 'ui-cols-list',

  /* m-io */
  'm-io', 'm-io-scope', 'm-io-format', 'm-io-logs', 'm-io-ratings',
  'ui-io-preview', 'btn-export',
  'm-io-file', 'btn-import-file', 'btn-import', 'ui-io-report',

  /* m-confirm */
  'm-confirm', 'ui-confirm-title', 'ui-confirm-text',
  'btn-confirm-cancel', 'btn-confirm-ok',

  /* menu paramètres */
  'ui-settings-menu', 'btn-types', 'btn-criteria', 'btn-cols', 'btn-io',
];

/* ─── Cache d'éléments ─── */
export const EL = {};

/** Peuple EL. À appeler une fois, avant tout le reste. */
export function cacheDom() {
  for (const id of REQUIRED_IDS) EL[id] = document.getElementById(id);
  return EL;
}

/** Ids attendus par le JS mais absents du DOM. */
export function assertDom() {
  const missing = REQUIRED_IDS.filter(id => !document.getElementById(id));
  if (missing.length) {
    console.error(
      `%c[assertDom] ${missing.length} id(s) manquant(s) dans index.html :`,
      'color:#f87171;font-weight:700', missing
    );
  } else {
    console.info(
      `%c[assertDom] ✓ ${REQUIRED_IDS.length}/${REQUIRED_IDS.length} ids présents`,
      'color:#34d399;font-weight:700'
    );
  }
  return missing;
}

/** Ids présents dans le DOM mais que le JS n'utilise pas. */
export function auditDom() {
  const inDom = new Set([...document.querySelectorAll('[id]')].map(n => n.id));
  const req = new Set(REQUIRED_IDS);
  const orphans = [...inDom].filter(id => !req.has(id));
  if (orphans.length) {
    console.warn(
      `%c[auditDom] ${orphans.length} id(s) orphelin(s) (HTML sans JS) :`,
      'color:#fbbf24;font-weight:700', orphans
    );
  }
  return orphans;
}

/* ─── Helpers ─── */

/** Écoute un événement sur un id. Silencieux mais tracé si absent. */
export function on(id, evt, fn, opts) {
  const el = EL[id] ?? document.getElementById(id);
  if (!el) { console.warn(`[on] "${id}" introuvable → ${evt} ignoré`); return null; }
  el.addEventListener(evt, fn, opts);
  return el;
}

/** Délégation : un seul listener sur un conteneur. */
export function onDelegate(id, evt, selector, fn) {
  return on(id, evt, e => {
    const t = e.target.closest(selector);
    if (t && EL[id]?.contains(t)) fn(e, t);
  });
}

export const $  = id => EL[id] ?? document.getElementById(id);
export const show = (id, v = true) => { const e = $(id); if (e) e.hidden = !v; };
export const hide = id => show(id, false);

export function setText(id, txt) { const e = $(id); if (e) e.textContent = txt ?? ''; }
export function setHtml(id, html) { const e = $(id); if (e) e.innerHTML = html ?? ''; }

export function val(id, v) {
  const e = $(id); if (!e) return '';
  if (v === undefined) return e.type === 'checkbox' ? e.checked : e.value;
  if (e.type === 'checkbox') e.checked = !!v; else e.value = v ?? '';
  return v;
}

/** Valeurs sélectionnées d'un <select multiple>. */
export function multiVal(id, arr) {
  const e = $(id); if (!e) return [];
  if (arr === undefined) return [...e.selectedOptions].map(o => o.value);
  const want = new Set(arr);
  for (const o of e.options) o.selected = want.has(o.value);
  return arr;
}

/** Remplit un <select>. opts : [{value,label}] ou [string]. */
export function fillSelect(id, opts, { placeholder = null } = {}) {
  const e = $(id); if (!e) return;
  const keep = e.multiple ? new Set(multiVal(id)) : new Set([e.value]);
  e.innerHTML = '';
  if (placeholder !== null && !e.multiple) {
    e.append(new Option(placeholder, ''));
  }
  for (const o of opts) {
    const value = typeof o === 'string' ? o : o.value;
    const label = typeof o === 'string' ? o : (o.label ?? o.value);
    const opt = new Option(label, value);
    if (keep.has(value)) opt.selected = true;
    e.append(opt);
  }
}

export const esc = s => String(s ?? '')
  .replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')
  .replace(/"/g, '"').replace(/'/g, ''');
