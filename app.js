/* ============================================
   Cultural Places Scout — app.js
   Vanilla JS + Supabase + Leaflet
   ============================================ */

// ── 1. CONFIGURATION (à remplir) ────────────────────────────────────────────
const CONFIG = {
  SUPABASE_URL:   'https://hawimjftwmrwljkjsnzu.supabase.co',   // ex: 'https://xxxxx.supabase.co'
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhhd2ltamZ0d21yd2xqa2pzbnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMjk4MTIsImV4cCI6MjEwMDgwNTgxMn0.Ej-PlxrKOd8cL9m3yQfIh3H9AvvDjY_d2xWGZskCz1s' // ex: 'eyJhbGci...'
};

// ── 2. ÉTAT GLOBAL ──────────────────────────────────────────────────────────
const state = {
  supabase:     null,
  session:      null,
  places:      [],          // tous les lieux chargés
  filtered:    [],          // lieux après filtrage
  editId:      null,        // id du lieu en cours d'édition (null = ajout)
  mapMode:     'pointer',   // 'pointer' | 'browse'
  map:         null,
  markers:     [],
  userLocation: null,
  mapClickHandler: null,
};

// ── 3. RÉFÉRENCES DOM ───────────────────────────────────────────────────────
const DOM = {
  // Screens
  setupBanner:    null,
  authScreen:     null,
  appScreen:      null,

  // Auth
  authTabs:       null,
  authForm:       null,
  authEmail:      null,
  authPassword:   null,
  authName:       null,
  authSubmit:     null,
  authError:      null,
  labelName:      null,

  // App header
  btnAdd:         null,
  btnLogout:      null,
  placesCount:    null,
  userEmail:      null,

  // Filters
  filterType:     null,
  filterStatus:   null,
  filterView:     null,
  searchInput:    null,

  // Views
  viewList:       null,
  viewMap:        null,
  placesTbody:    null,

  // Map
  map:            null,
  mapToolbar:     null,
  btnFitBounds:   null,
  btnFrance:      null,
  btnGeoloc:      null,
  btnPointer:     null,
  mapModeLabel:   null,
  coordTooltip:   null,

  // Modal
  placeModal:     null,
  modalTitle:     null,
  modalClose:     null,
  placeForm:      null,
  btnDelete:      null,
  btnCancel:      null,
  btnSave:        null,
  btnClearGeo:    null,

  // Status
  statusMsg:      null,
  toastContainer: null,
};

// ── 4. INIT ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // population refs
  Object.keys(DOM).forEach(key => {
    DOM[key] = document.getElementById(key) || document.querySelector('.' + key);
  });

  // resolve alias simples
  DOM.placesTbody  = document.getElementById('places-tbody');
  DOM.toastContainer = document.getElementById('toast-container');
  DOM.coordTooltip = document.getElementById('coord-tooltip');
  DOM.map = document.getElementById('map');

  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
    showScreen('setup');
    return;
  }

  initSupabase();
  bindEvents();
  showScreen('auth');
});

// ── 5. SUPABASE INIT ─────────────────────────────────────────────────────────
function initSupabase() {
  const { createClient } = window.supabase || {};
  if (!createClient) {
    // charger le SDK si absent (fallback)
    state.supabase = null;
    return;
  }
  state.supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  state.supabase.auth.getSession().then(({ data }) => {
    state.session = data.session;
    if (state.session) {
      showScreen('app');
      loadPlaces();
    } else {
      showScreen('auth');
    }
  });
  state.supabase.auth.onAuthStateChange((_e, session) => {
    state.session = session;
    if (session) {
      showScreen('app');
      loadPlaces();
    } else {
      showScreen('auth');
    }
  });
}

// ── 6. SCREEN MANAGEMENT ────────────────────────────────────────────────────
function showScreen(name) {
  document.getElementById('setup-banner')?.classList.toggle('hidden', name !== 'setup');
  document.getElementById('auth-screen')?.classList.toggle('hidden', name !== 'auth');
  document.getElementById('app-screen')?.classList.toggle('hidden', name !== 'app');
}

// ── 7. AUTH ──────────────────────────────────────────────────────────────────
function bindEvents() {
  // ── Auth tabs
  document.getElementById('auth-tabs')?.addEventListener('click', e => {
    if (!e.target.matches('.tab-btn')) return;
    const tab = e.target.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById('auth-submit').textContent = tab === 'register' ? 'Inscription' : 'Connexion';
    document.getElementById('label-name')?.classList.toggle('hidden', tab === 'login');
    document.getElementById('auth-name')?.classList.toggle('hidden', tab === 'login');
  });

  // ── Auth form
  document.getElementById('auth-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email    = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const name     = document.getElementById('auth-name')?.value.trim();
    const isRegister = document.querySelector('.tab-btn.active')?.dataset.tab === 'register';
    const errorEl  = document.getElementById('auth-error');
    errorEl.classList.add('hidden');
    try {
      if (isRegister) {
        const { error } = await state.supabase.auth.signUp({ email, password, options: { data: { full_name: name || '' } } });
        if (error) throw error;
        showToast('Compte créé — vérifiez votre email', 'success');
      } else {
        const { data, error } = await state.supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        state.session = data.session;
        showScreen('app');
        loadPlaces();
      }
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    }
  });

  // ── Logout
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await state.supabase?.auth.signOut();
    state.session = null;
    showScreen('auth');
    document.getElementById('auth-form').reset();
  });

  // ── Filters
  document.getElementById('filter-type')?.addEventListener('change', applyFilters);
  document.getElementById('filter-status')?.addEventListener('change', applyFilters);
  document.getElementById('search-input')?.addEventListener('input', debounce(applyFilters, 250));
  document.getElementById('filter-view')?.addEventListener('change', switchView);

  // ── Header buttons
  document.getElementById('btn-add')?.addEventListener('click', () => openModal(null));

  // ── Map toolbar
  document.getElementById('btn-fit-bounds')?.addEventListener('click', fitMarkers);
  document.getElementById('btn-france')?.addEventListener('click', () => {
    if (state.map) {
      state.map.setView([46.6034, 2.5], 6);
      if (state.mapMode === 'browse') state.map.scrollWheelZoom.enable();
    }
  });
  document.getElementById('btn-geoloc')?.addEventListener('click', goToMyLocation);
  document.getElementById('btn-pointer')?.addEventListener('click', togglePointerMode);

  // ── Modal
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('btn-cancel')?.addEventListener('click', closeModal);
  document.getElementById('btn-delete')?.addEventListener('click', deleteCurrentPlace);
  document.getElementById('btn-clear-geo')?.addEventListener('click', clearGeoFields);
  document.getElementById('place-form')?.addEventListener('submit', handleFormSubmit);

  // ── Modal backdrop click closes it
  document.getElementById('place-modal')?.addEventListener('click', e => {
    if (e.target.id === 'place-modal') closeModal();
  });

  // ── ESC closes modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

// ── 8. VIEW SWITCHING ────────────────────────────────────────────────────────
function switchView() {
  const view = document.getElementById('filter-view')?.value || 'list';
  document.getElementById('view-list')?.classList.toggle('active', view === 'list');
  document.getElementById('view-map')?.classList.toggle('active', view === 'map');

  if (view === 'map') {
    if (!state.map) initMap();
    else setTimeout(() => state.map.invalidateSize(), 50);
  }
}

// ── 9. MAP ────────────────────────────────────────────────────────────────────
function initMap() {
  if (!document.getElementById('map') || state.map) return;

  state.map = L.map('map', { zoomControl: true }).setView([46.6034, 2.5], 6);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 18,
  }).addTo(state.map);

  // ── Map click: only capture coords in pointer mode ──
  state.mapClickHandler = e => {
    if (state.mapMode !== 'pointer') return;
    const { lat, lng } = e.latlng;
    document.getElementById('place-lat').value = lat.toFixed(6);
    document.getElementById('place-lng').value = lng.toFixed(6);
    showCoordTooltip(lat, lng);
  };
  state.map.on('click', state.mapClickHandler);

  // render markers once map ready
  state.map.whenReady(() => renderMarkers());
  state.map.on('moveend', renderMarkers);
  state.map.on('zoomend', renderMarkers);
}

function renderMarkers() {
  if (!state.map) return;

  // clear existing markers
  state.markers.forEach(m => m.remove());
  state.markers = [];

  const places = state.filtered;
  const bounds = L.latLngBounds();

  places.forEach(place => {
    if (!place.latitude || !place.longitude) return;
    const marker = L.marker([place.latitude, place.longitude])
      .addTo(state.map)
      .bindPopup(buildPopupHTML(place));
    state.markers.push(marker);
    bounds.extend([place.latitude, place.longitude]);
  });

  // store bounds for fit-bounds button
  state.markersBounds = bounds.isValid() ? bounds : null;
}

function buildPopupHTML(place) {
  const typeLabel = TYPE_LABELS[place.type] || place.type;
  return `<div>
    <strong>${escHtml(place.name)}</strong><br>
    <span style="font-size:12px;color:var(--text-muted)">${escHtml(place.city)}</span><br>
    <span style="font-size:11px">${typeLabel}</span>
    <div style="margin-top:6px;display:flex;gap:4px">
      <button onclick="openModal('${place.id}')" style="background:var(--primary);color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px">Éditer</button>
    </div>
  </div>`;
}

// ── Map Toolbar Buttons ──
function fitMarkers() {
  if (!state.map || !state.markersBounds) {
    showToast('Aucun lieu avec coordonnées', 'error');
    return;
  }
  state.map.fitBounds(state.markersBounds, { padding: [40, 40], maxZoom: 12 });
}

async function goToMyLocation() {
  if (!state.map) return;
  if (!navigator.geolocation) {
    showToast('Géolocalisation non disponible', 'error');
    return;
  }
  showToast('Recherche de position…');
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      state.userLocation = [lat, lng];
      state.map.setView([lat, lng], 14);
      showToast(`Position: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    },
    err => showToast('Position non accessible — vérifiez les permissions', 'error')
  );
}

function togglePointerMode() {
  const btn = document.getElementById('btn-pointer');
  const label = document.getElementById('map-mode-label');

  if (state.mapMode === 'pointer') {
    state.mapMode = 'browse';
    btn?.classList.remove('active');
    btn?.setAttribute('title', 'Désactivé');
    if (label) label.textContent = 'Mode pointer: inactif';
    // disable map click capture
    if (state.map && state.mapClickHandler) {
      state.map.off('click', state.mapClickHandler);
    }
  } else {
    state.mapMode = 'pointer';
    btn?.classList.add('active');
    btn?.setAttribute('title', 'Cliquer pour capturer les coordonnées');
    if (label) label.textContent = 'Mode pointer: actif';
    // re-enable map click capture
    if (state.map) {
      state.map.on('click', state.mapClickHandler);
    }
  }
}

function showCoordTooltip(lat, lng) {
  const tip = document.getElementById('coord-tooltip');
  if (!tip) return;
  tip.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  tip.classList.remove('hidden');
  clearTimeout(tip._timer);
  tip._timer = setTimeout(() => tip.classList.add('hidden'), 3000);
}

// ── 10. CRUD PLACES ──────────────────────────────────────────────────────────
async function loadPlaces() {
  if (!state.supabase) return;
  setStatus('Chargement…');
  const { data, error } = await state.supabase
    .from('places')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    showToast('Erreur chargement: ' + error.message, 'error');
    setStatus('Erreur chargement');
    return;
  }

  state.places = data || [];
  state.filtered = [...state.places];
  updateCount();
  applyFilters();
  renderMarkers();
  setStatus('Prêt');
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const data = getFormData();

  // validation minimale
  if (!data.name?.trim()) { showToast('Le nom est requis', 'error'); return; }
  if (!data.city?.trim()) { showToast('La ville est requise', 'error'); return; }

  const payload = {
    name:          data.name.trim(),
    type:          data.type || 'other',
    description:   data.description || null,
    address:       data.address || null,
    city:          data.city.trim(),
    postal_code:   data.postal || null,
    country:       data.country || null,
    latitude:      parseFloat(data.lat) || null,
    longitude:     parseFloat(data.lng) || null,
    contact_email: data.email || null,
    phone:         data.phone || null,
    website:       data.website || null,
    status:        data.status || 'prospect',
    priority:      data.priority || 'low',
    surface_m2:    parseFloat(data.surface) || null,
    rent_monthly:  parseFloat(data.rent) || null,
    favorite:      !!data.favorite,
    notes:         data.notes || null,
    tags:          data.tags || null,
    next_date:     data.next_date || null,
  };

  setStatus('Enregistrement…');
  let result;
  if (state.editId) {
    result = await state.supabase.from('places').update(payload).eq('id', state.editId);
  } else {
    result = await state.supabase.from('places').insert(payload);
  }

  const { error } = result;
  if (error) {
    showToast('Erreur: ' + error.message, 'error');
    setStatus('Erreur');
    return;
  }

  showToast(state.editId ? 'Lieu mis à jour' : 'Lieu ajouté', 'success');
  closeModal();
  await loadPlaces();
}

async function deleteCurrentPlace() {
  if (!state.editId) return;
  if (!confirm('Supprimer ce lieu ?')) return;
  setStatus('Suppression…');
  const { error } = await state.supabase.from('places').delete().eq('id', state.editId);
  if (error) {
    showToast('Erreur: ' + error.message, 'error');
    setStatus('Erreur');
    return;
  }
  showToast('Lieu supprimé', 'success');
  closeModal();
  await loadPlaces();
}

// ── 11. MODAL ────────────────────────────────────────────────────────────────
function openModal(id) {
  state.editId = id;
  const modal = document.getElementById('place-modal');
  const title = document.getElementById('modal-title');
  const deleteBtn = document.getElementById('btn-delete');

  if (!modal) return;

  document.getElementById('place-form').reset();
  clearGeoFields();
  document.getElementById('place-country').value = 'France';

  if (id) {
    title.textContent = 'Modifier un lieu';
    deleteBtn?.classList.remove('hidden');
    const place = state.places.find(p => p.id === id);
    if (place) populateForm(place);
  } else {
    title.textContent = 'Ajouter un lieu';
    deleteBtn?.classList.add('hidden');
  }

  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  document.getElementById('place-name')?.focus();
}

function closeModal() {
  const modal = document.getElementById('place-modal');
  modal?.classList.add('hidden');
  document.body.classList.remove('modal-open');
  state.editId = null;
}

function populateForm(place) {
  const map = {
    'place-name':        'name',
    'place-type':        'type',
    'place-description': 'description',
    'place-address':     'address',
    'place-city':        'city',
    'place-postal':      'postal_code',
    'place-country':     'country',
    'place-lat':         'latitude',
    'place-lng':         'longitude',
    'place-email':       'contact_email',
    'place-phone':       'phone',
    'place-website':     'website',
    'place-status':      'status',
    'place-priority':    'priority',
    'place-surface':     'surface_m2',
    'place-rent':        'rent_monthly',
    'place-notes':       'notes',
    'place-tags':        'tags',
    'place-next-date':   'next_date',
  };
  Object.entries(map).forEach(([fieldId, key]) => {
    const el = document.getElementById(fieldId);
    if (!el) return;
    const val = place[key];
    if (el.type === 'checkbox') el.checked = !!val;
    else el.value = val ?? '';
  });
}

function getFormData() {
  return {
    name:      document.getElementById('place-name')?.value,
    type:      document.getElementById('place-type')?.value,
    desc:      document.getElementById('place-description')?.value,
    address:   document.getElementById('place-address')?.value,
    city:      document.getElementById('place-city')?.value,
    postal:    document.getElementById('place-postal')?.value,
    country:   document.getElementById('place-country')?.value,
    lat:       document.getElementById('place-lat')?.value,
    lng:       document.getElementById('place-lng')?.value,
    email:     document.getElementById('place-email')?.value,
    phone:     document.getElementById('place-phone')?.value,
    website:   document.getElementById('place-website')?.value,
    status:    document.getElementById('place-status')?.value,
    priority:  document.getElementById('place-priority')?.value,
    surface:   document.getElementById('place-surface')?.value,
    rent:      document.getElementById('place-rent')?.value,
    favorite:  document.getElementById('place-favorite')?.checked,
    notes:     document.getElementById('place-notes')?.value,
    tags:      document.getElementById('place-tags')?.value,
    next_date: document.getElementById('place-next-date')?.value,
  };
}

function clearGeoFields() {
  const latEl = document.getElementById('place-lat');
  const lngEl = document.getElementById('place-lng');
  if (latEl) latEl.value = '';
  if (lngEl) lngEl.value = '';
}

// ── 12. FILTERS ─────────────────────────────────────────────────────────────
function applyFilters() {
  const type    = document.getElementById('filter-type')?.value || '';
  const status  = document.getElementById('filter-status')?.value || '';
  const search  = (document.getElementById('search-input')?.value || '').toLowerCase().trim();

  state.filtered = state.places.filter(p => {
    if (type && p.type !== type) return false;
    if (status && p.status !== status) return false;
    if (search) {
      const hay = `${p.name || ''} ${p.city || ''} ${p.address || ''} ${p.tags || ''} ${p.notes || ''}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  renderTable();
  if (state.map) renderMarkers();
}

function renderTable() {
  const tbody = document.getElementById('places-tbody');
  if (!tbody) return;

  if (state.filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">
      Aucun lieu${state.places.length > 0 ? ' — essayez de modifier les filtres' : ' — ajoutez le premier lieu'}
    </td></tr>`;
    return;
  }

  tbody.innerHTML = state.filtered.map(p => `
    <tr data-id="${p.id}">
      <td class="td-name">
        ${p.favorite ? '<span title="Favori">⭐</span> ' : ''}${escHtml(p.name || '—')}
      </td>
      <td>${badgeType(p.type)}</td>
      <td>${escHtml(p.city || '—')}</td>
      <td>${badgeStatus(p.status)}</td>
      <td class="td-fav">${p.favorite ? '⭐' : ''}</td>
      <td class="action-btns">
        <button onclick="openModal('${p.id}')" title="Éditer">✏️</button>
        <button onclick="quickToggleFav('${p.id}')" title="Favori">${p.favorite ? '☆' : '⭐'}</button>
      </td>
    </tr>
  `).join('');
}

// ── 13. FAVORITE QUICK TOGGLE ────────────────────────────────────────────────
async function quickToggleFav(id) {
  const place = state.places.find(p => p.id === id);
  if (!place || !state.supabase) return;
  const { error } = await state.supabase
    .from('places')
    .update({ favorite: !place.favorite })
    .eq('id', id);
  if (error) {
    showToast('Erreur: ' + error.message, 'error');
    return;
  }
  place.favorite = !place.favorite;
  renderTable();
  if (state.map) renderMarkers();
}

// ── 14. HELPERS ───────────────────────────────────────────────────────────────
const TYPE_LABELS = {
  gallery:  'Galerie d\'art',
  museum:    'Musée',
  theater:   'Théâtre',
  concert:   'Salle de concert',
  library:   'Bibliothèque',
  cinema:    'Cinéma',
  other:     'Autre',
};

const STATUS_LABELS = {
  prospect:   'Prospect',
  contacted:  'Contacté',
  contracted: 'Sous contrat',
  archived:    'Archivé',
};

function badgeType(type) {
  const labels = TYPE_LABELS;
  return `<span class="badge-type type-${type || 'other'}">${labels[type] || type || '—'}</span>`;
}

function badgeStatus(status) {
  return `<span class="badge-status status-${status || 'prospect'}">${STATUS_LABELS[status] || status || '—'}</span>`;
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function setStatus(msg) {
  const el = document.getElementById('status-msg');
  if (el) el.textContent = msg;
}

function updateCount() {
  const el = document.getElementById('places-count');
  if (el) el.textContent = `${state.places.length} lieu${state.places.length !== 1 ? 'x' : ''}`;
  if (document.getElementById('user-email') && state.session?.user?.email) {
    document.getElementById('user-email').textContent = state.session.user.email;
  }
}

function showToast(msg, type = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast${type ? ' ' + type : ''}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Globals for inline onclick attributes ──
window.openModal = openModal;
window.quickToggleFav = quickToggleFav;
