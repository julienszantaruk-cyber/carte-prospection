/* ============================================
   Cultural Places Scout — app.js
   Vanilla JS, Supabase v2, Leaflet CDN
   ============================================ */

// ─────────────────────────────────────────────
// 1. CONFIGURATION
//    Remplacez ces valeurs par celles de
//    votre projet Supabase.
// ─────────────────────────────────────────────
const CONFIG = {
  SUPABASE_URL:  'YOUR_SUPABASE_URL',   // ex: https://xxxxx.supabase.co
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY', // ex: eyJhbGciOiJIUzI1...
};

// ─────────────────────────────────────────────
// 2. HELPERS
// ─────────────────────────────────────────────

/** Affiche un toast en bas à droite */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

/** Active/désactive un bouton pendant les requêtes */
function setLoading(button, loading) {
  if (!button) return;
  button.disabled = loading;
  if (loading) button.dataset.originalText = button.textContent;
  button.textContent = loading ? '…' : (button.dataset.originalText || button.textContent);
}

/** Normalise le texte pour affichage (échappement XSS) */
function esc(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/** URL web sûre */
function safeUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith('http') ? url : 'https://' + url);
    return u.href;
  } catch {
    return null;
  }
}

/** Labels lisibles pour types */
const TYPE_LABELS = {
  gallery: 'Galerie',
  museum: 'Musée',
  theater: 'Théâtre',
  concert: 'Concert',
  cultural_center: 'Centre culturel',
  library: 'Bibliothèque',
  cinema: 'Cinéma',
  other: 'Autre',
};

/** Labels lisibles pour statuts */
const STATUS_LABELS = {
  prospect: 'Prospect',
  contacted: 'Contacté',
  negotiating: 'En négociation',
  contracted: 'Contrat',
  archived: 'Archivé',
};

/** Labels de priorité */
const PRIORITY_LABELS = {
  high: 'Haute',
  medium: 'Moyenne',
  low: 'Basse',
};

// ─────────────────────────────────────────────
// 3. STATE
// ─────────────────────────────────────────────
let supabase = null;
let map = null;
let markers = [];           // { id, marker }
let places = [];           // todos los lugares cargados
let editingId = null;       // UUID en cours d'édition (null = création)
let currentView = 'list';   // 'list' | 'map'
let favoritesOnly = false; // filtre favoris
let mapClickListener = null;

// ─────────────────────────────────────────────
// 4. INIT / AUTH
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!window.supabase) {
    document.getElementById('setup-banner').classList.remove('hidden');
    document.getElementById('auth-screen').querySelector('.auth-box').innerHTML =
      '<p style="color:#f85149;text-align:center">❌ Supabase JS non chargé.<br>Vérifiez votre connexion internet.</p>';
    return;
  }

  supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

  // Vérifier config
  if (CONFIG.SUPABASE_URL === 'YOUR_SUPABASE_URL' || !CONFIG.SUPABASE_URL.startsWith('https')) {
    document.getElementById('setup-banner').classList.remove('hidden');
  }

  // Bind events
  bindAuth();
  bindPlaces();
  bindMap();

  // Restaurer session
  restoreSession();
});

function restoreSession() {
  showScreen('auth');
  supabase.auth.getSession().then(({ data }) => {
    if (data.session) {
      onAuthSuccess(data.session.user);
    }
  });
  // Écouter les changements d'authentification
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      onAuthSuccess(session.user);
    } else {
      onLogout();
    }
  });
}

function onAuthSuccess(user) {
  document.getElementById('user-email').textContent = user.email;
  showScreen('app');
  loadPlaces();
}

function onLogout() {
  places = [];
  clearMarkers();
  document.getElementById('places-tbody').innerHTML = '';
  document.getElementById('user-email').textContent = '';
  showScreen('auth');
  resetAuthForm();
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  const mapScreen = document.getElementById('app-screen');
  if (name === 'app') mapScreen.classList.remove('hidden');
  if (name === 'auth') document.getElementById('auth-screen').classList.remove('hidden');
}

// ─────────────────────────────────────────────
// 5. AUTH BINDINGS
// ─────────────────────────────────────────────
function bindAuth() {
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      const isRegister = tab === 'register';
      document.getElementById('auth-submit').textContent = isRegister ? 'Créer un compte' : 'Connexion';
      document.getElementById('confirm-group').style.display = isRegister ? 'flex' : 'none';
      document.getElementById('auth-error').classList.add('hidden');
    });
  });

  // Form submit
  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('auth-error');
    errorEl.classList.add('hidden');
    const submitBtn = document.getElementById('auth-submit');
    setLoading(submitBtn, true);

    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const isRegister = document.querySelector('.tab-btn.active').dataset.tab === 'register';

    try {
      if (isRegister) {
        const confirm = document.getElementById('auth-confirm').value;
        if (password !== confirm) {
          throw new Error('Les mots de passe ne correspondent pas.');
        }
        if (password.length < 6) {
          throw new Error('Le mot de passe doit contenir au moins 6 caractères.');
        }
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        showToast('Compte créé ! Vérifiez votre email ou connectez-vous.', 'success');
        resetAuthForm();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showToast('Connexion réussie !', 'success');
      }
    } catch (err) {
      errorEl.textContent = err.message || 'Erreur de connexion.';
      errorEl.classList.remove('hidden');
    } finally {
      setLoading(submitBtn, false);
    }
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
  });
}

function resetAuthForm() {
  document.getElementById('auth-form').reset();
  document.getElementById('auth-confirm').value = '';
  document.getElementById('confirm-group').style.display = 'none';
  document.getElementById('auth-error').classList.add('hidden');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-tab="login"]').classList.add('active');
  document.getElementById('auth-submit').textContent = 'Connexion';
}

// ─────────────────────────────────────────────
// 6. MAP
// ─────────────────────────────────────────────
function initMap() {
  if (map) return;
  map = L.map('map', { zoomControl: true }).setView([46.6031, 2.0], 6);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(map);

  // Clic sur carte → remplir lat/lng
  mapClickListener = L.DomEvent.on(map, 'click', (e) => {
    const lat = e.latlng.lat.toFixed(6);
    const lng = e.latlng.lng.toFixed(6);
    document.getElementById('place-lat').value = lat;
    document.getElementById('place-lng').value = lng;

    const tooltip = document.getElementById('map-coord-tooltip');
    tooltip.textContent = `📍 ${lat}, ${lng}`;
    tooltip.classList.remove('hidden');
    clearTimeout(window._coordTooltipTimer);
    window._coordTooltipTimer = setTimeout(() => tooltip.classList.add('hidden'), 3000);
  });
}

function createMarkerIcon(type) {
  // Couleurs par type
  const colors = {
    gallery: '#a78bfa',
    museum: '#60a5fa',
    theater: '#f87171',
    concert: '#86efac',
    cultural_center: '#fcd34d',
    library: '#93c5fd',
    cinema: '#f9a8d4',
    other: '#9ca3af',
  };
  const color = colors[type] || colors.other;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22s14-12.667 14-22C28 6.268 21.732 0 14 0z" fill="${color}"/><circle cx="14" cy="14" r="6" fill="white" opacity="0.85"/></svg>`;
  return L.divIcon({
    html: svg,
    className: 'custom-marker',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
  });
}

function renderMarkers() {
  clearMarkers();
  const filtered = getFilteredPlaces();
  filtered.forEach(p => {
    if (p.lat && p.lng) {
      const marker = L.marker([p.lat, p.lng], { icon: createMarkerIcon(p.type) }).addTo(map);
      const content = `
        <div style="min-width:200px">
          <strong style="font-size:14px">${esc(p.name)}</strong><br>
          <span style="color:#8b949e;font-size:12px">${esc(p.city || '')}${p.country ? ', ' + esc(p.country) : ''}</span><br>
          <span class="badge-type ${esc(p.type)}">${esc(TYPE_LABELS[p.type] || p.type)}</span>
          <span class="badge-status ${esc(p.status)}">${esc(STATUS_LABELS[p.status] || p.status)}</span>
          ${p.favorite ? '<br>⭐' : ''}
          ${p.address ? `<br><small style="color:#8b949e">${esc(p.address)}</small>` : ''}
          ${p.contact_email ? `<br><small>✉️ <a href="mailto:${esc(p.contact_email)}" style="color:#58a6ff">${esc(p.contact_email)}</a></small>` : ''}
          ${p.website ? `<br><small>🔗 <a href="${esc(safeUrl(p.website))}" target="_blank" rel="noopener" style="color:#58a6ff">${esc(p.website)}</a></small>` : ''}
          <br><button onclick="openEditModal('${p.id}')" style="margin-top:6px;background:#21262d;border:1px solid #30363d;color:#c9d1d9;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px">Éditer</button>
        </div>`;
      marker.bindPopup(content);
      markers.push({ id: p.id, marker });
    }
  });
}

function clearMarkers() {
  markers.forEach(({ marker }) => marker.remove());
  markers = [];
}

function fitBounds() {
  if (!map || markers.length === 0) return;
  const latlngs = markers.map(({ marker }) => marker.getLatLng()).filter(ll => ll);
  if (latlngs.length === 0) return;
  if (latlngs.length === 1) {
    map.setView(latlngs[0], 13);
  } else {
    map.fitBounds(latlngs, { padding: [40, 40], maxZoom: 12 });
  }
}

function bindMap() {
  // Bouton cadrer
  document.getElementById('btn-fit-markers').addEventListener('click', fitBounds);

  // Switch vue liste/carte
  document.getElementById('filter-view').addEventListener('change', (e) => {
    currentView = e.target.value;
    const mapPanel = document.getElementById('view-map');
    const listPanel = document.getElementById('view-list');
    if (currentView === 'map') {
      mapPanel.classList.remove('hidden');
      listPanel.classList.add('hidden');
      setTimeout(() => {
        initMap();
        renderMarkers();
        if (markers.length > 0) fitBounds();
        else map.invalidateSize();
      }, 50);
    } else {
      mapPanel.classList.add('hidden');
      listPanel.classList.remove('hidden');
    }
  });

  // Géolocalisation
  document.getElementById('btn-geolocate').addEventListener('click', () => {
    if (!navigator.geolocation) {
      showToast('Géolocalisation non disponible.', 'error');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        document.getElementById('place-lat').value = pos.coords.latitude.toFixed(6);
        document.getElementById('place-lng').value = pos.coords.longitude.toFixed(6);
        showToast('Position définie ✓', 'success');
      },
      () => showToast('Impossible d\'obtenir la position.', 'error')
    );
  });
}

// ─────────────────────────────────────────────
// 7. PLACES CRUD
// ─────────────────────────────────────────────
async function loadPlaces() {
  setStatus('Chargement…');
  try {
    const { data, error } = await supabase
      .from('places')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    places = data || [];
    renderPlaces();
    if (currentView === 'map') renderMarkers();
    setStatus(`${places.length} lieu(x) chargé(s)`);
  } catch (err) {
    showToast('Erreur chargement: ' + (err.message || err), 'error');
    setStatus('Erreur de chargement');
  }
}

async function savePlace(formData) {
  setLoading(document.getElementById('btn-save-place'), true);
  try {
    const now = new Date().toISOString();
    const payload = {
      name: formData.name,
      type: formData.type,
      description: formData.description || null,
      address: formData.address || null,
      city: formData.city,
      postal_code: formData.postal_code || null,
      country: formData.country || null,
      lat: formData.lat || null,
      lng: formData.lng || null,
      contact_email: formData.contact_email || null,
      phone: formData.phone || null,
      website: safeUrl(formData.website) || null,
      tags: formData.tags || null,
      status: formData.status,
      priority: formData.priority,
      favorite: formData.favorite || false,
      surface_m2: formData.surface_m2 || null,
      rent_monthly: formData.rent_monthly || null,
      notes: formData.notes || null,
      next_action: formData.next_action || null,
      next_date: formData.next_date || null,
      updated_at: now,
    };

    if (editingId) {
      const { error } = await supabase
        .from('places')
        .update(payload)
        .eq('id', editingId);
      if (error) throw error;
      places = places.map(p => p.id === editingId ? { ...p, ...payload } : p);
      showToast('Lieu mis à jour ✓', 'success');
    } else {
      payload.created_at = now;
      const { data, error } = await supabase
        .from('places')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      places.unshift(data);
      showToast('Lieu ajouté ✓', 'success');
    }

    renderPlaces();
    if (currentView === 'map') renderMarkers();
    closeModal();
  } catch (err) {
    showToast('Erreur: ' + (err.message || err), 'error');
    document.getElementById('place-form-error').textContent = err.message || 'Erreur inconnue';
    document.getElementById('place-form-error').classList.remove('hidden');
  } finally {
    setLoading(document.getElementById('btn-save-place'), false);
  }
}

async function deletePlace(id) {
  if (!confirm('Supprimer ce lieu ?')) return;
  try {
    const { error } = await supabase.from('places').delete().eq('id', id);
    if (error) throw error;
    places = places.filter(p => p.id !== id);
    renderPlaces();
    if (currentView === 'map') renderMarkers();
    closeModal();
    showToast('Lieu supprimé ✓', 'success');
  } catch (err) {
    showToast('Erreur suppression: ' + (err.message || err), 'error');
  }
}

// ─────────────────────────────────────────────
// 8. FILTERS
// ─────────────────────────────────────────────
function getFilteredPlaces() {
  const search = document.getElementById('filter-search').value.toLowerCase().trim();
  const type = document.getElementById('filter-type').value;
  const status = document.getElementById('filter-status').value;

  return places.filter(p => {
    if (favoritesOnly && !p.favorite) return false;
    if (type && p.type !== type) return false;
    if (status && p.status !== status) return false;
    if (search) {
      const haystack = [
        p.name, p.city, p.country, p.address,
        p.description, p.tags, p.notes, p.contact_email,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function renderPlaces() {
  const filtered = getFilteredPlaces();
  document.getElementById('place-count').textContent = `${places.length} lieu(x)`;

  const tbody = document.getElementById('places-tbody');
  const noPlaces = document.getElementById('no-places');

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    noPlaces.classList.remove('hidden');
    return;
  }
  noPlaces.classList.add('hidden');

  tbody.innerHTML = filtered.map(p => {
    const favBtn = `<button class="btn-icon ${p.favorite ? 'active-star' : ''}" onclick="event.stopPropagation();toggleFavorite('${p.id}')" title="Favori">${p.favorite ? '⭐' : '☆'}</button>`;
    const websiteLink = p.website
      ? `<a href="${esc(safeUrl(p.website))}" target="_blank" rel="noopener" style="color:#58a6ff">🔗</a>`
      : '';
    return `<tr onclick="openEditModal('${p.id}')">
      <td class="td-name">${esc(p.name)}</td>
      <td><span class="badge-type ${esc(p.type)}">${esc(TYPE_LABELS[p.type] || p.type)}</span></td>
      <td class="td-type">${esc(p.city || '')}</td>
      <td class="td-status"><span class="badge-status ${esc(p.status)}">${esc(STATUS_LABELS[p.status] || p.status)}</span></td>
      <td class="td-fav">${favBtn}</td>
      <td class="td-actions">
        <button class="btn-secondary" onclick="event.stopPropagation();openEditModal('${p.id}')">✏️</button>
        ${websiteLink}
      </td>
    </tr>`;
  }).join('');
}

async function toggleFavorite(id) {
  const place = places.find(p => p.id === id);
  if (!place) return;
  const newFav = !place.favorite;
  try {
    const { error } = await supabase
      .from('places')
      .update({ favorite: newFav, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    place.favorite = newFav;
    renderPlaces();
    if (currentView === 'map') renderMarkers();
  } catch (err) {
    showToast('Erreur favoris: ' + (err.message || err), 'error');
  }
}

function bindPlaces() {
  // Filtres en temps réel
  ['filter-search', 'filter-type', 'filter-status'].forEach(id => {
    document.getElementById(id).addEventListener('input', renderPlaces);
    document.getElementById(id).addEventListener('change', renderPlaces);
  });

  // Bouton favoris
  document.getElementById('btn-my-locations').addEventListener('click', () => {
    favoritesOnly = !favoritesOnly;
    const btn = document.getElementById('btn-my-locations');
    btn.classList.toggle('btn-primary', favoritesOnly);
    btn.classList.toggle('btn-secondary', !favoritesOnly);
    renderPlaces();
  });

  // Bouton ajout
  document.getElementById('btn-add-place').addEventListener('click', () => {
    editingId = null;
    openModal(null);
  });

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-place').addEventListener('click', closeModal);
  document.getElementById('btn-delete-place').addEventListener('click', () => deletePlace(editingId));

  // Backdrop close
  document.getElementById('place-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Form submit
  document.getElementById('place-form').addEventListener('submit', (e) => {
    e.preventDefault();
    document.getElementById('place-form-error').classList.add('hidden');
    const form = e.target;
    const formData = {
      name: form['place-name'].value.trim(),
      type: form['place-type'].value,
      description: form['place-description'].value.trim(),
      address: form['place-address'].value.trim(),
      city: form['place-city'].value.trim(),
      postal_code: form['place-postal'].value.trim(),
      country: form['place-country'].value.trim(),
      lat: form['place-lat'].value ? parseFloat(form['place-lat'].value) : null,
      lng: form['place-lng'].value ? parseFloat(form['place-lng'].value) : null,
      contact_email: form['place-email'].value.trim(),
      phone: form['place-phone'].value.trim(),
      website: form['place-website'].value.trim(),
      tags: form['place-tags'].value.trim(),
      status: form['place-status'].value,
      priority: form['place-priority'].value,
      favorite: form['place-favorite'].checked,
      surface_m2: form['place-surface'].value ? parseFloat(form['place-surface'].value) : null,
      rent_monthly: form['place-rent'].value ? parseFloat(form['place-rent'].value) : null,
      notes: form['place-notes'].value.trim(),
      next_action: form['place-next-action'].value.trim(),
      next_date: form['place-next-date'].value || null,
    };
    savePlace(formData);
  });
}

// ─────────────────────────────────────────────
// 9. MODAL
// ─────────────────────────────────────────────
function openModal(place) {
  const modal = document.getElementById('place-modal');
  const form = document.getElementById('place-form');
  const title = document.getElementById('modal-title');
  const deleteBtn = document.getElementById('btn-delete-place');
  const errorEl = document.getElementById('place-form-error');

  errorEl.classList.add('hidden');

  if (place) {
    title.textContent = '✏️ Modifier le lieu';
    deleteBtn.classList.remove('hidden');
    form['place-name'].value = place.name || '';
    form['place-type'].value = place.type || '';
    form['place-description'].value = place.description || '';
    form['place-address'].value = place.address || '';
    form['place-city'].value = place.city || '';
    form['place-postal'].value = place.postal_code || '';
    form['place-country'].value = place.country || '';
    form['place-lat'].value = place.lat || '';
    form['place-lng'].value = place.lng || '';
    form['place-email'].value = place.contact_email || '';
    form['place-phone'].value = place.phone || '';
    form['place-website'].value = place.website || '';
    form['place-tags'].value = place.tags || '';
    form['place-status'].value = place.status || 'prospect';
    form['place-priority'].value = place.priority || 'medium';
    form['place-favorite'].checked = place.favorite || false;
    form['place-surface'].value = place.surface_m2 || '';
    form['place-rent'].value = place.rent_monthly || '';
    form['place-notes'].value = place.notes || '';
    form['place-next-action'].value = place.next_action || '';
    form['place-next-date'].value = place.next_date || '';
  } else {
    title.textContent = '➕ Ajouter un lieu';
    deleteBtn.classList.add('hidden');
    form.reset();
    form['place-country'].value = 'France';
    form['place-status'].value = 'prospect';
    form['place-priority'].value = 'medium';
  }

  modal.classList.remove('hidden');
  form['place-name'].focus();
}

function closeModal() {
  document.getElementById('place-modal').classList.add('hidden');
  editingId = null;
}

/** Ouvre le modal en mode édition (appelé depuis marker popup) */
window.openEditModal = function(id) {
  const place = places.find(p => p.id === id);
  if (!place) return;
  editingId = id;
  if (currentView !== 'map') {
    const listPanel = document.getElementById('view-list');
    const mapPanel = document.getElementById('view-map');
    listPanel.classList.remove('hidden');
    mapPanel.classList.add('hidden');
    currentView = 'list';
    document.getElementById('filter-view').value = 'list';
  }
  openModal(place);
};

// ─────────────────────────────────────────────
// 10. UTILITIES
// ─────────────────────────────────────────────
function setStatus(msg) {
  document.getElementById('status-msg').textContent = msg;
}