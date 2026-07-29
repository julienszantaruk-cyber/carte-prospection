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

  // Chaque module est isolé : un plantage n'en bloque pas un autre
  safe('list',  () => list.render());
  if (S.tab === 'map')   safe('map',   () => map.render());
  if (S.tab === 'table') safe('table', () => table.render());
  if (S.tab === 'dash')  safe('dash',  () => dash.render());
}

/** Exécute fn en capturant l'erreur, pour ne pas casser le cycle de rendu */
function safe(label, fn){
  try{ fn(); }
  catch(e){ console.error(`[render:${label}]`, e); }
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
  if (!TABS[name]) name = 'map';
  S.tab = name;

  // Bascule AVANT tout effet de bord : rien ne peut l'empêcher
  for (const t of Object.keys(TABS)){
    EL['btn-view-' + t]?.classList.toggle('is-active', t === name);
    const pane = EL[TABS[t]];
    if (pane) pane.hidden = (t !== name);
  }

  safe('saveLocal', saveLocal);

  if (name === 'map' && S.mapReady) safe('map:size', () => map.refreshSize());

  render();
}

/* ─────────────────────────────────────────────
   OUVERTURE D'UNE FICHE
   ───────────────────────────────────────────── */
async function openPlace(id){
  try{
    await sheet.open(id);
  }catch(e){
    console.error('[sheet.open]', e);
    err("Impossible d'ouvrir la fiche.");
    return;
  }
  if (id && S.tab === 'map') safe('map:focus', () => map.focusOn(id));
  render();
}

/* ─────────────────────────────────────────────
   RACCOURCIS CLAVIER
   ───────────────────────────────────────────── */
function initKeys(){
  document.addEventListener('keydown', (e) => {
    const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)
                 || e.target.isContentEditable;

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
      const sh = EL['ui-sheet'];
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

  // 1. Rendre le panneau visible AVANT d'initialiser Leaflet
  setTab(S.tab || 'map');

  // 2. Carte : une seule initialisation pour toute la session
  if (!S.mapReady){
    try{
      map.initMap(openPlace);
      map.bindZoom();
      S.mapReady = true;
      map.render();          // premier peuplement des marqueurs
      map.fit();
    }catch(e){
      console.error('[map] init', e);
      err('La carte n\'a pas pu s\'initialiser.');
    }
  } else {
    safe('map:fit', () => map.fit());
  }

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
   if (assertDom().length){
    console.warn('[boot] DOM incomplet — certaines fonctions seront inertes');
  }

  loadLocal();

  // Modules indépendants de la session
  initConfirm();
  initKeys();

  // Rendu déclenché par le tri du tableau ou le déplacement de la carte
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
