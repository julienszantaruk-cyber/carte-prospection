/* ═══════════════════════════════════════════════════════
   17 · BOOT — assemblage et cycle de vie
   ═══════════════════════════════════════════════════════ */

import { S, loadLocal, saveLocal } from './state.js';
import { EL, assertDom, on, setTxt } from './dom.js';
import * as auth   from './auth.js';
import * as data   from './data.js';
import * as filt   from './filters.js';
import * as map    from './map.js';
import * as list   from './list.js';
import * as table  from './table.js';
import * as dash   from './dash.js';
import * as sheet  from './sheet.js';
import * as sets   from './settings.js';
import * as io     from './io.js';
import { toast, ok, err, initConfirm } from './toast.js';

/* ─────────────────────────────────────────────
   RENDU — un seul point d'entrée
   ───────────────────────────────────────────── */
function render(){
  filt.apply();          // recalcule S.view
  list.render();         // toujours (panneau latéral visible partout)

  if (S.tab === 'map')   map.render();
  if (S.tab === 'table') table.render();
  if (S.tab === 'dash')  dash.render();
}

/** Rechargement complet depuis Supabase, puis rendu */
async function reload(){
  try{
    await data.loadPlaces();
    render();
  }catch(e){
    console.error(e);
    err('Impossible de recharger les données.');
  }
}

/* ─────────────────────────────────────────────
   ONGLETS
   ───────────────────────────────────────────── */
const TABS = { map:'v-map', table:'v-table', dash:'v-dash' };

function setTab(name){
  S.tab = name;
  saveLocal();

  for (const t of Object.keys(TABS)){
    EL['btn-view-' + t]?.classList.toggle('is-active', t === name);
    const pane = EL[TABS[t]];
    if (pane) pane.hidden = (t !== name);
  }

  if (name === 'map') map.refreshSize();
  render();
}

/* ─────────────────────────────────────────────
   OUVERTURE D'UNE FICHE
   ───────────────────────────────────────────── */
async function openPlace(id){
  await sheet.open(id);
  if (id && S.tab === 'map') map.focusOn(id);
  render();   // pour rafraîchir la sélection dans la liste / le tableau
}

/* ─────────────────────────────────────────────
   RACCOURCIS CLAVIER
   ───────────────────────────────────────────── */
function initKeys(){
  document.addEventListener('keydown', (e) => {
    const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);

    // "/" → focus recherche
    if (e.key === '/' && !inField){
      e.preventDefault();
      EL['flt-search']?.focus();
      return;
    }
    // "n" → nouveau lieu
    if ((e.key === 'n' || e.key === 'N') && !inField && !e.metaKey && !e.ctrlKey){
      e.preventDefault();
      openPlace(null);
      return;
    }
    // Ctrl/Cmd + S → enregistrer si la fiche est ouverte
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's'){
      const sh = EL['sheet'];
      if (sh && !sh.hidden){
        e.preventDefault();
        EL['btn-save']?.click();
      }
    }
  });
}

/* ─────────────────────────────────────────────
   APRÈS CONNEXION
   ───────────────────────────────────────────── */
async function start(user){
  // auth.js gère déjà l'affichage de v-app / v-auth et l'email
  setTxt('ui-status', 'Chargement…');
  try{
    await data.loadAll();
    setTxt('ui-status', '');
  }catch(e){
    console.error(e);
    setTxt('ui-status', 'Erreur de chargement');
    err('Connexion à la base impossible. Vérifie les policies RLS.');
    return;
  }

  // Carte : on l'initialise une seule fois
  if (!S.mapReady){
    map.initMap(openPlace);
    map.bindZoom();
    S.mapReady = true;
  }

  // Restauration de l'onglet mémorisé
  setTab(S.tab || 'map');
  map.fit();

  const n = S.places.length;
  if (n === 0) toast('Base vide — appuie sur « N » pour créer ton premier lieu.', 'ok');
  else         ok(`${n} lieu(x) chargé(s)`);
}

async function stop(){
  // auth.js gère déjà le basculement v-app → v-auth
  S.places = []; S.view = []; S.logs = [];
  S.selId = null;
  sheet.close();
}

/* ─────────────────────────────────────────────
   BOOT
   ───────────────────────────────────────────── */
async function boot(){
  if (!assertDom()) {
    // ids manquants : on log déjà en rouge, on continue en mode dégradé
    console.warn('[boot] DOM incomplet — certaines fonctions seront inertes');
  }

  loadLocal();

  // Modules indépendants de la session
  initConfirm();
  initKeys();

  // Rendu déclenché par le tri du tableau
  window.addEventListener('app:rerender', render);

  // Onglets
  on('btn-view-map',   'click', () => setTab('map'));
  on('btn-view-table', 'click', () => setTab('table'));
  on('btn-view-dash',  'click', () => setTab('dash'));

  // Nouveau lieu
  on('btn-new', 'click', () => openPlace(null));

  // Modules dépendant des données
  filt.initFilters(render);
  list.initList(openPlace);
  table.initTable(openPlace);
  dash.initDash(openPlace);
  sheet.initSheet(reload);
  sets.initSettings(reload);
  io.initIo(reload);

  // Auth en dernier : c'est lui qui déclenche start()
  auth.initAuth({ onLogin: start, onLogout: stop });
}

/* Go */
if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
