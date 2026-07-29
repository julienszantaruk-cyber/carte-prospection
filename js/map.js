/* ═══════════════════════════════════════════════════════
   10 · CARTE — Leaflet, marqueurs, clustering léger
   ═══════════════════════════════════════════════════════ */

import { MAP } from './config.js';
import { S, typeById } from './state.js';
import { EL, on, esc } from './dom.js';
/* PAS d'import de sheet.js : le mode pointage passe par startPick(cb).
   Un import croisé map <-> sheet créerait une dépendance circulaire. */

let map      = null;
let layer    = null;
let openCb   = () => {};
let pickMode = false;
let pickCb   = null;

export function initMap(onOpen){
  openCb = onOpen || openCb;

  const host = EL['ui-map'] || document.getElementById('ui-map');
  if (!host){
    console.error('[map] #ui-map introuvable — carte non initialisée');
    return;
  }
  if (typeof L === 'undefined'){
    console.error('[map] Leaflet (L) non chargé — vérifie le <script> dans index.html');
    return;
  }

  map = L.map(host, {
    center: MAP.center,
    zoom  : MAP.zoom,
    zoomControl: true,
    attributionControl: true
  });

  // Fond clair CARTO Positron — les marqueurs colorés ressortent
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &middot; &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  layer = L.layerGroup().addTo(map);

  on('btn-fit',    'click', fit);
  on('btn-locate', 'click', locate);
  on('btn-pick',   'click', () => togglePick());

  /* Un SEUL handler de clic, à l'intérieur de initMap() */
  map.on('click', (e) => {
    if (!pickMode) return;
    const { lat, lng } = e.latlng;
    const cb = pickCb;
    togglePick(false);
    cb?.(+lat.toFixed(6), +lng.toFixed(6));
  });

  map.on('zoomend', render);
  map.on('moveend', () => {
    if (S.flt?.inView) window.dispatchEvent(new Event('app:rerender'));
  });

  window.addEventListener('resize', () => map?.invalidateSize());
}

export function refreshSize(){
  setTimeout(() => map?.invalidateSize(), 60);
}

/* ─── Mode pointage ─── */
export function togglePick(force){
  pickMode = (force === undefined) ? !pickMode : !!force;
  if (!pickMode) pickCb = null;
  EL['btn-pick']?.classList.toggle('is-active', pickMode);
  EL['ui-map']?.classList.toggle('is-picking', pickMode);
}

/** Appelé par sheet.js : demande une coordonnée à l'utilisateur */
export function startPick(cb){
  pickCb = cb;
  togglePick(true);
}

/** Le panneau interroge l'état courant */
export function isPickingMap(){
  return pickMode;
}

/* ─── Géolocalisation ─── */
function locate(){
  if (!navigator.geolocation || !map) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 13),
    ()    => {},
    { timeout: 8000 }
  );
}

/* ─── Marqueur HTML pur ─── */
function pinIcon(p){
  const t     = typeById(p.type_id);
  const color = t?.color || '#6366f1';
  const emoji = t?.emoji || '📍';
  const fav   = p.favorite ? '<span class="pin-fav">★</span>' : '';
  return L.divIcon({
    className: 'pin-wrap',
    html: `<div class="pin" style="--pin:${color}">
             <span class="pin-emoji">${emoji}</span>${fav}
           </div>`,
    iconSize   : [30, 38],
    iconAnchor : [15, 38],
    popupAnchor: [0, -34]
  });
}

function popupHtml(p){
  const t  = typeById(p.type_id);
  const sc = Number.isFinite(p.score) ? p.score : null;
  return `
    <div class="popup-name">${esc(p.name || '(sans nom)')}</div>
    <div class="popup-meta">
      ${t ? esc(t.emoji + ' ' + t.label) : ''}
      ${p.city ? ' · ' + esc(p.city) : ''}
      ${sc !== null ? ` · <b>${sc}</b>/100` : ''}
    </div>
    <button class="popup-btn" data-open="${esc(String(p.id))}">Ouvrir la fiche</button>
  `;
}

/* ─── Clustering maison : grille en pixels ─── */
function clusterize(items){
  if (!S.cluster || !map) return items.map(p => ({ single: p }));

  const z = map.getZoom();
  if (z >= 13) return items.map(p => ({ single: p }));

  const cell    = 60;
  const buckets = new Map();

  for (const p of items){
    const pt  = map.latLngToLayerPoint([p.lat, p.lng]);
    const key = `${Math.floor(pt.x / cell)}:${Math.floor(pt.y / cell)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(p);
  }

  const out = [];
  for (const group of buckets.values()){
    if (group.length === 1) out.push({ single: group[0] });
    else out.push({ group });
  }
  return out;
}

function clusterIcon(n){
  const size = n < 10 ? 34 : n < 50 ? 42 : 50;
  return L.divIcon({
    className: 'cluster-wrap',
    html: `<div class="cluster" style="width:${size}px;height:${size}px">${n}</div>`,
    iconSize  : [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

/* ─── Rendu ─── */
export function render(){
  if (!layer || !map) return;
  layer.clearLayers();

  const pts = (S.view || []).filter(p =>
    Number.isFinite(p.lat) && Number.isFinite(p.lng)
  );

  for (const item of clusterize(pts)){
    if (item.single){
      const p = item.single;
      const m = L.marker([p.lat, p.lng], { icon: pinIcon(p) });
      m.bindPopup(popupHtml(p));
      m.on('popupopen', (e) => {
        e.popup.getElement()
          ?.querySelector('[data-open]')
          ?.addEventListener('click', () => openCb(p.id));
      });
      m.addTo(layer);
    } else {
      const g   = item.group;
      const lat = g.reduce((s, p) => s + p.lat, 0) / g.length;
      const lng = g.reduce((s, p) => s + p.lng, 0) / g.length;
      const m   = L.marker([lat, lng], { icon: clusterIcon(g.length) });
      m.on('click', () => {
        map.fitBounds(L.latLngBounds(g.map(p => [p.lat, p.lng])).pad(0.3));
      });
      m.addTo(layer);
    }
  }
}

/** Cadre la vue sur les lieux visibles */
export function fit(){
  if (!map) return;
  const pts = (S.view || []).filter(p =>
    Number.isFinite(p.lat) && Number.isFinite(p.lng)
  );
  if (!pts.length) return;
  if (pts.length === 1){
    map.setView([pts[0].lat, pts[0].lng], MAP.zoomOne);
  } else {
    map.fitBounds(L.latLngBounds(pts.map(p => [p.lat, p.lng])).pad(0.15));
  }
}

/** Centre sur un lieu précis */
export function focusOn(id){
  if (!map) return;
  const p = S.places.find(x => x.id === id);
  if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
  map.setView([p.lat, p.lng], MAP.zoomOne, { animate: true });
}

/** Bornes actuelles — pour le filtre « dans la vue » */
export function currentBounds(){
  return map?.getBounds() || null;
}
