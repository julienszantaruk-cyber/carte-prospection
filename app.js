/* ============================================
   Cultural Places Scout — app.js
   Vanilla JS + Supabase v2 + Leaflet
   ============================================ */

'use strict';

// ─────────────────────────────────────────────
// 1. CONFIGURATION SUPABASE
// ─────────────────────────────────────────────

const CONFIG = {
  SUPABASE_URL: 'https://hawimjftwmrwljkjsnzu.supabase.co',

  SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhhd2ltamZ0d21yd2xqa2pzbnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMjk4MTIsImV4cCI6MjEwMDgwNTgxMn0.Ej-PlxrKOd8cL9m3yQfIh3H9AvvDjY_d2xWGZskCz1s'
};

// ─────────────────────────────────────────────
// 2. ÉTAT GLOBAL
// ─────────────────────────────────────────────

const state = {
  supabase: null,
  session: null,
  places: [],
  filtered: [],
  editId: null,
  placeTypes: [],          // ← nouveau

  currentView: 'map',

  map: null,
  markers: [],
  markersBounds: null,
  userLocationMarker: null,
  mapClickHandler: null,
  mapMode: 'pointer',

  tileLayers: {},
  activeTileLayer: null,
  mapStyle: 'dark',

  geoResults: [],          // ← nouveau
  geoIndex: -1,            // ← nouveau
  geoAbort: null,          // ← nouveau

  authMode: 'login',
  initialized: false
};

const FALLBACK_TYPES = [
  { slug: 'gallery', label: "Galerie d'art", icon: '🖼️', color: '#d4adff', is_system: true },
  { slug: 'museum',  label: 'Musée',         icon: '🏛️', color: '#8bc1ff', is_system: true },
  { slug: 'theater', label: 'Théâtre',       icon: '🎭', color: '#ff9ca2', is_system: true },
  { slug: 'concert', label: 'Salle de concert', icon: '🎵', color: '#ff9ed5', is_system: true },
  { slug: 'library', label: 'Bibliothèque',  icon: '📚', color: '#7be5a7', is_system: true },
  { slug: 'cinema',  label: 'Cinéma',        icon: '🎬', color: '#ffb77f', is_system: true },
  { slug: 'other',   label: 'Autre',         icon: '📍', color: '#bdc6d3', is_system: true }
];

const STATUS_LABELS = {
  prospect: 'Prospect',
  contacted: 'Contacté',
  contracted: 'Sous contrat',
  archived: 'Archivé'
};

function typeBySlug(slug) {
  return state.placeTypes.find(t => t.slug === slug) || null;
}

function typeLabel(slug) {
  return typeBySlug(slug)?.label || slug || 'Autre';
}

// ─────────────────────────────────────────────
//  TYPES DE LIEU (dynamiques)
// ─────────────────────────────────────────────

async function loadPlaceTypes() {
  if (!state.supabase || !getCurrentUserId()) {
    state.placeTypes = [...FALLBACK_TYPES];
    renderTypeOptions();
    return;
  }

  try {
    const { data, error } = await state.supabase
      .from('place_types')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true });

    if (error) throw error;

    state.placeTypes = (data && data.length) ? data : [...FALLBACK_TYPES];
  } catch (error) {
    console.error('Erreur loadPlaceTypes :', error);
    state.placeTypes = [...FALLBACK_TYPES];
    showToast('Types de lieu : repli sur la liste par défaut.', 'error');
  }

  renderTypeOptions();
}

function renderTypeOptions() {
  const filterSelect = document.getElementById('filter-type');
  const formSelect = document.getElementById('place-type');

  if (filterSelect) {
    const previous = filterSelect.value;
    filterSelect.innerHTML =
      '<option value="">Tous les types</option>' +
      state.placeTypes.map(t =>
        `<option value="${escAttribute(t.slug)}">${escHtml(t.icon || '')} ${escHtml(t.label)}</option>`
      ).join('');
    filterSelect.value = previous;
  }

  if (formSelect) {
    const previous = formSelect.value;
    formSelect.innerHTML = state.placeTypes.map(t =>
      `<option value="${escAttribute(t.slug)}">${escHtml(t.icon || '')} ${escHtml(t.label)}</option>`
    ).join('');
    formSelect.value = previous || 'other';
  }
}

function slugify(text) {
  return String(text)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || ('type-' + Date.now().toString(36));
}

function openTypesModal() {
  renderTypesList();
  document.getElementById('types-modal')?.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeTypesModal() {
  document.getElementById('types-modal')?.classList.add('hidden');
  if (document.getElementById('place-modal')?.classList.contains('hidden')) {
    document.body.classList.remove('modal-open');
  }
}

function renderTypesList() {
  const list = document.getElementById('types-list');
  if (!list) return;

  list.innerHTML = state.placeTypes.map(t => `
    <li class="type-item">
      <span class="type-dot" style="background:${escAttribute(t.color || '#bdc6d3')}"></span>
      <span class="type-item-icon">${escHtml(t.icon || '📍')}</span>
      <span class="type-item-label">${escHtml(t.label)}</span>
      ${t.is_system
        ? '<span class="type-item-tag">intégré</span>'
        : `<button type="button" class="type-delete" data-id="${escAttribute(t.id)}" title="Supprimer">🗑️</button>`}
    </li>
  `).join('');
}

async function handleTypeCreate(event) {
  event.preventDefault();

  const userId = getCurrentUserId();
  if (!state.supabase || !userId) {
    showToast('Session expirée.', 'error');
    return;
  }

  const label = getFieldValue('type-label');
  const icon = getFieldValue('type-icon') || '📍';
  const color = getFieldValue('type-color') || '#4f8cff';

  if (!label) {
    showToast('Le nom du type est obligatoire.', 'error');
    return;
  }

  const slug = slugify(label);

  if (state.placeTypes.some(t => t.slug === slug)) {
    showToast('Ce type existe déjà.', 'error');
    return;
  }

  const button = document.getElementById('btn-add-type');
  if (button) button.disabled = true;

  try {
    const { error } = await state.supabase.from('place_types').insert({
      owner_id: userId,
      slug, label, icon, color,
      is_system: false,
      sort_order: 500
    });

    if (error) throw error;

    document.getElementById('type-form')?.reset();
    setFieldValue('type-icon', '📍');
    setFieldValue('type-color', '#4f8cff');

    await loadPlaceTypes();
    renderTypesList();
    applyFilters();

    setFieldValue('place-type', slug);
    showToast(`Type « ${label} » créé.`, 'success');
  } catch (error) {
    console.error('Erreur création type :', error);
    showToast('Erreur : ' + error.message, 'error');
  } finally {
    if (button) button.disabled = false;
  }
}

async function handleTypeDelete(id) {
  const userId = getCurrentUserId();
  const type = state.placeTypes.find(t => String(t.id) === String(id));
  if (!type || !userId) return;

  const used = state.places.filter(p => p.type === type.slug).length;

  const message = used
    ? `${used} lieu(x) utilisent « ${type.label} ». Ils basculeront sur « Autre ». Continuer ?`
    : `Supprimer le type « ${type.label} » ?`;

  if (!window.confirm(message)) return;

  try {
    if (used) {
      const { error: updateError } = await state.supabase
        .from('places')
        .update({ type: 'other' })
        .eq('owner_id', userId)
        .eq('type', type.slug);

      if (updateError) throw updateError;
    }

    const { error } = await state.supabase
      .from('place_types')
      .delete()
      .eq('id', id)
      .eq('owner_id', userId);

    if (error) throw error;

    await loadPlaceTypes();
    renderTypesList();
    await loadPlaces();

    showToast('Type supprimé.', 'success');
  } catch (error) {
    console.error('Erreur suppression type :', error);
    showToast('Erreur : ' + error.message, 'error');
  }
}

// ─────────────────────────────────────────────
//  GÉOCODAGE / AUTOCOMPLÉTION D'ADRESSE
// ─────────────────────────────────────────────

const BAN_URL = 'https://api-adresse.data.gouv.fr/search/';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

function isFranceSelected() {
  const country = getFieldValue('place-country').toLowerCase();
  return !country || country.startsWith('fr');
}

function setAddressStatus(message, kind = '') {
  const element = document.getElementById('address-status');
  if (!element) return;
  element.textContent = message;
  element.className = 'address-status' + (kind ? ' ' + kind : '');
}

async function searchAddress(query) {
  if (state.geoAbort) state.geoAbort.abort();
  state.geoAbort = new AbortController();

  const signal = state.geoAbort.signal;
  const city = getFieldValue('place-city');

  try {
    if (isFranceSelected()) {
      const url = new URL(BAN_URL);
      url.searchParams.set('q', query);
      url.searchParams.set('limit', '6');
      url.searchParams.set('autocomplete', '1');

      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error('HTTP ' + response.status);

      const json = await response.json();

      return (json.features || []).map(f => ({
        main: f.properties.name || f.properties.label,
        sub: [f.properties.postcode, f.properties.city].filter(Boolean).join(' '),
        address: f.properties.name || '',
        city: f.properties.city || '',
        postal: f.properties.postcode || '',
        country: 'France',
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0]
      }));
    }

    const url = new URL(NOMINATIM_URL);
    url.searchParams.set('q', city ? `${query}, ${city}` : query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '6');

    const response = await fetch(url, {
      signal,
      headers: { 'Accept-Language': 'fr' }
    });

    if (!response.ok) throw new Error('HTTP ' + response.status);

    const json = await response.json();

    return (json || []).map(item => {
      const a = item.address || {};
      const street = [a.house_number, a.road].filter(Boolean).join(' ');

      return {
        main: street || item.name || item.display_name.split(',')[0],
        sub: item.display_name,
        address: street || item.name || '',
        city: a.city || a.town || a.village || a.municipality || '',
        postal: a.postcode || '',
        country: a.country || '',
        lat: Number(item.lat),
        lng: Number(item.lon)
      };
    });
  } catch (error) {
    if (error.name === 'AbortError') return null;
    throw error;
  }
}

function renderSuggestions(results) {
  const list = document.getElementById('address-suggestions');
  if (!list) return;

  state.geoResults = results;
  state.geoIndex = -1;

  if (!results.length) {
    list.classList.add('hidden');
    list.innerHTML = '';
    return;
  }

  list.innerHTML = results.map((r, i) => `
    <li role="option" data-index="${i}">
      <span class="suggestion-main">${escHtml(r.main)}</span>
      <span class="suggestion-sub">${escHtml(r.sub)}</span>
    </li>
  `).join('');

  list.classList.remove('hidden');
}

function hideSuggestions() {
  const list = document.getElementById('address-suggestions');
  list?.classList.add('hidden');
  state.geoIndex = -1;
}

function applySuggestion(index) {
  const result = state.geoResults[index];
  if (!result) return;

  setFieldValue('place-address', result.address || result.main);
  if (result.city) setFieldValue('place-city', result.city);
  if (result.postal) setFieldValue('place-postal', result.postal);
  if (result.country) setFieldValue('place-country', result.country);

  setFieldValue('place-lat', result.lat.toFixed(6));
  setFieldValue('place-lng', result.lng.toFixed(6));

  hideSuggestions();
  setAddressStatus('✓ Adresse et coordonnées renseignées.', 'ok');

  if (state.map) {
    state.map.setView([result.lat, result.lng], 16);
    showCoordTooltip(result.lat, result.lng);
  }
}

const handleAddressInput = debounce(async () => {
  const query = getFieldValue('place-address');

  if (query.length < 3) {
    hideSuggestions();
    setAddressStatus('');
    return;
  }

  setAddressStatus('Recherche…');

  try {
    const results = await searchAddress(query);
    if (results === null) return;

    renderSuggestions(results);
    setAddressStatus(results.length ? '' : 'Aucun résultat.', results.length ? '' : 'ko');
  } catch (error) {
    console.error('Erreur géocodage :', error);
    setAddressStatus('Service de recherche indisponible.', 'ko');
    hideSuggestions();
  }
}, 320);

function handleAddressKeydown(event) {
  const list = document.getElementById('address-suggestions');
  const isOpen = list && !list.classList.contains('hidden');

  if (!isOpen) return;

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    const count = state.geoResults.length;

    state.geoIndex = (state.geoIndex + delta + count) % count;

    list.querySelectorAll('li').forEach((li, i) => {
      li.classList.toggle('active', i === state.geoIndex);
    });
  } else if (event.key === 'Enter') {
    if (state.geoIndex >= 0) {
      event.preventDefault();
      applySuggestion(state.geoIndex);
    }
  } else if (event.key === 'Escape') {
    event.stopPropagation();
    hideSuggestions();
  }
}


// ─────────────────────────────────────────────
// 4. DÉMARRAGE
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', startApp);

async function startApp() {
  if (state.initialized) return;

  state.initialized = true;
  restoreMapStyle();
  bindEvents();

  try {
    initializeSupabase();

    const {
      data: { session },
      error
    } = await state.supabase.auth.getSession();

    if (error) throw error;

    state.session = session;

    state.supabase.auth.onAuthStateChange((event, newSession) => {
      state.session = newSession;

      window.setTimeout(async () => {
        if (newSession) {
          showScreen('app');
          updateUserDisplay();

          if (
            event === 'SIGNED_IN' ||
            event === 'INITIAL_SESSION' ||
            event === 'TOKEN_REFRESHED'
          ) {
            await loadPlaces();
          }
        } else {
          clearLocalData();
          showScreen('auth');
        }
      }, 0);
    });

    if (session) {
      showScreen('app');
      updateUserDisplay();
      await loadPlaces();
    } else {
      showScreen('auth');
    }
  } catch (error) {
    console.error('Erreur initialisation :', error);
    showScreen('setup');

    const banner = document.getElementById('setup-banner');

    if (banner) {
      banner.classList.remove('hidden');
      banner.innerHTML = `
        <div class="banner-content">
          <strong>⚠️ Erreur d'initialisation</strong><br>
          ${escHtml(error.message)}
        </div>
      `;
    }
  }
}

function initializeSupabase() {
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
    throw new Error('URL ou clé Supabase manquante dans app.js.');
  }

  if (!window.supabase?.createClient) {
    throw new Error(
      'Le SDK Supabase ne s’est pas chargé. Vérifie le script Supabase dans index.html.'
    );
  }

  state.supabase = window.supabase.createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    }
  );

  if (!state.supabase?.auth) {
    throw new Error('Impossible de créer le client Supabase.');
  }
}

// ─────────────────────────────────────────────
// 5. GESTION DES ÉCRANS
// ─────────────────────────────────────────────

function showScreen(name) {
  const setupBanner = document.getElementById('setup-banner');
  const authScreen = document.getElementById('auth-screen');
  const appScreen = document.getElementById('app-screen');

  setupBanner?.classList.toggle('hidden', name !== 'setup');
  authScreen?.classList.toggle('hidden', name !== 'auth');
  appScreen?.classList.toggle('hidden', name !== 'app');

  if (name === 'app') {
    switchView('map');

    window.setTimeout(() => {
      if (!state.map) {
        initMap();
      }

      state.map?.invalidateSize();
      renderMarkers();
    }, 150);
  }
}

function clearLocalData() {
  state.session = null;
  state.places = [];
  state.filtered = [];
  state.editId = null;

  renderTable();
  renderMarkers();
  updateCount();

  const userEmail = document.getElementById('user-email');
  if (userEmail) userEmail.textContent = '';
}

// ─────────────────────────────────────────────
// 6. ÉVÉNEMENTS
// ─────────────────────────────────────────────

function bindEvents() {
  // --- Authentification ---
  document.getElementById('auth-tabs')?.addEventListener('click', event => {
    const button = event.target.closest('.tab-btn');
    if (!button) return;

    setAuthMode(button.dataset.tab);
  });

  document
    .getElementById('auth-form')
    ?.addEventListener('submit', handleAuthSubmit);

  document
    .getElementById('btn-logout')
    ?.addEventListener('click', handleLogout);

  // --- Barre d'outils principale ---
  document
    .getElementById('btn-add')
    ?.addEventListener('click', () => openModal(null));

  document
    .getElementById('filter-type')
    ?.addEventListener('change', applyFilters);

  document
    .getElementById('filter-status')
    ?.addEventListener('change', applyFilters);

  document
    .getElementById('search-input')
    ?.addEventListener('input', debounce(applyFilters, 250));

  document
    .getElementById('view-switcher')
    ?.addEventListener('click', event => {
      const button = event.target.closest('.view-btn');
      if (!button) return;

      switchView(button.dataset.view);
    });

  // --- Carte ---
  document
    .getElementById('map-style')
    ?.addEventListener('change', event => {
      changeMapStyle(event.target.value);
    });

  document
    .getElementById('btn-fit-bounds')
    ?.addEventListener('click', fitMarkers);

  document
    .getElementById('btn-france')
    ?.addEventListener('click', centerOnFrance);

  document
    .getElementById('btn-geoloc')
    ?.addEventListener('click', goToMyLocation);

  document
    .getElementById('btn-pointer')
    ?.addEventListener('click', togglePointerMode);

  // --- Modale lieu ---
  document
    .getElementById('modal-close')
    ?.addEventListener('click', closeModal);

  document
    .getElementById('btn-cancel')
    ?.addEventListener('click', closeModal);

  document
    .getElementById('btn-delete')
    ?.addEventListener('click', deleteCurrentPlace);

  document
    .getElementById('btn-clear-geo')
    ?.addEventListener('click', clearGeoFields);

  document
    .getElementById('place-form')
    ?.addEventListener('submit', handleFormSubmit);

  document.getElementById('place-modal')?.addEventListener('click', event => {
    if (event.target.id === 'place-modal') {
      closeModal();
    }
  });

  // --- Gestion des types de lieu ---
  document
    .getElementById('btn-manage-types')
    ?.addEventListener('click', openTypesModal);

  document
    .getElementById('btn-new-type')
    ?.addEventListener('click', openTypesModal);

  document
    .getElementById('types-close')
    ?.addEventListener('click', closeTypesModal);

  document
    .getElementById('type-form')
    ?.addEventListener('submit', handleTypeCreate);

  document.getElementById('types-list')?.addEventListener('click', event => {
    const button = event.target.closest('.type-delete');
    if (!button) return;

    handleTypeDelete(button.dataset.id);
  });

  document.getElementById('types-modal')?.addEventListener('click', event => {
    if (event.target.id === 'types-modal') {
      closeTypesModal();
    }
  });

  // --- Autocomplétion d'adresse ---
  const addressInput = document.getElementById('place-address');

  addressInput?.addEventListener('input', handleAddressInput);
  addressInput?.addEventListener('keydown', handleAddressKeydown);

  addressInput?.addEventListener('blur', () => {
    // Délai pour laisser le clic sur une suggestion se produire
    window.setTimeout(hideSuggestions, 180);
  });

  document
    .getElementById('address-suggestions')
    ?.addEventListener('mousedown', event => {
      const item = event.target.closest('li[data-index]');
      if (!item) return;

      event.preventDefault();
      applySuggestion(Number(item.dataset.index));
    });

  document.getElementById('btn-geocode')?.addEventListener('click', () => {
    const query = getFieldValue('place-address');

    if (query.length < 3) {
      setAddressStatus('Saisis au moins 3 caractères.', 'ko');
      return;
    }

    handleAddressInput();
  });

  // --- Raccourci clavier global ---
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;

    const typesModal = document.getElementById('types-modal');

    // La modale des types est au-dessus : on la ferme en priorité
    if (typesModal && !typesModal.classList.contains('hidden')) {
      closeTypesModal();
      return;
    }

    closeModal();
  });
}

// ─────────────────────────────────────────────
// 7. AUTHENTIFICATION
// ─────────────────────────────────────────────

function setAuthMode(mode) {
  state.authMode = mode === 'register' ? 'register' : 'login';

  document.querySelectorAll('.tab-btn').forEach(button => {
    button.classList.toggle(
      'active',
      button.dataset.tab === state.authMode
    );
  });

  const isRegister = state.authMode === 'register';
  const submitButton = document.getElementById('auth-submit');
  const nameGroup = document.getElementById('auth-name-group');
  const nameInput = document.getElementById('auth-name');
  const passwordInput = document.getElementById('auth-password');

  if (submitButton) {
    submitButton.textContent = isRegister ? 'Inscription' : 'Connexion';
  }

  // On masque le groupe entier (label + input) : plus propre
  nameGroup?.classList.toggle('hidden', !isRegister);

  if (passwordInput) {
    passwordInput.autocomplete = isRegister
      ? 'new-password'
      : 'current-password';
  }

  if (!isRegister && nameInput) {
    nameInput.value = '';
  }

  hideAuthError();
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  if (!state.supabase?.auth) {
    showAuthError(
      'Supabase n’est pas initialisé. Vérifie les scripts dans index.html.'
    );
    return;
  }

  const email = document.getElementById('auth-email')?.value.trim();
  const password = document.getElementById('auth-password')?.value || '';
  const fullName = document.getElementById('auth-name')?.value.trim();

  if (!email || !password) {
    showAuthError('L’email et le mot de passe sont obligatoires.');
    return;
  }

  if (password.length < 6) {
    showAuthError('Le mot de passe doit contenir au moins 6 caractères.');
    return;
  }

  const submitButton = document.getElementById('auth-submit');

  hideAuthError();

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Patientez…';
  }

  try {
    if (state.authMode === 'register') {
      const { data, error } = await state.supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName || '' }
        }
      });

      if (error) throw error;

      if (data.session) {
        state.session = data.session;

        showScreen('app');
        updateUserDisplay();

        await loadPlaceTypes();
        await loadPlaces();

        showToast('Compte créé et connecté.', 'success');
      } else {
        showToast(
          'Compte créé. Vérifie ton email pour confirmer ton inscription.',
          'success'
        );

        setAuthMode('login');
      }
    } else {
      const { data, error } =
        await state.supabase.auth.signInWithPassword({ email, password });

      if (error) throw error;

      if (!data.session) {
        throw new Error('Aucune session reçue après la connexion.');
      }

      state.session = data.session;

      showScreen('app');
      updateUserDisplay();

      await loadPlaceTypes();
      await loadPlaces();

      showToast('Connexion réussie.', 'success');
    }
  } catch (error) {
    // ⚠️ C'était ici le bug : le catch contenait le code de savePlace
    // et référençait une variable "payload" inexistante → ReferenceError,
    // qui masquait totalement la vraie erreur d'authentification.
    console.error('Erreur authentification :', {
      mode: state.authMode,
      code: error?.code,
      status: error?.status,
      message: error?.message
    });

    showAuthError(translateAuthError(error?.message));
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent =
        state.authMode === 'register' ? 'Inscription' : 'Connexion';
    }
  }
}

async function handleLogout() {
  if (!state.supabase?.auth) return;

  try {
    const { error } = await state.supabase.auth.signOut();
    if (error) throw error;

    clearLocalData();
    showScreen('auth');

    document.getElementById('auth-form')?.reset();
    setAuthMode('login');

    showToast('Déconnexion réussie.', 'success');
  } catch (error) {
    console.error('Erreur déconnexion :', error);
    showToast('Erreur : ' + error.message, 'error');
  }
}

function showAuthError(message) {
  const element = document.getElementById('auth-error');
  if (!element) return;

  element.textContent = message;
  element.classList.remove('hidden');
}

function hideAuthError() {
  const element = document.getElementById('auth-error');
  if (!element) return;

  element.textContent = '';
  element.classList.add('hidden');
}

function translateAuthError(message = '') {
  const lowerMessage = String(message).toLowerCase();

  if (lowerMessage.includes('invalid login credentials')) {
    return 'Email ou mot de passe incorrect.';
  }

  if (lowerMessage.includes('email not confirmed')) {
    return 'Tu dois confirmer ton adresse email avant de te connecter.';
  }

  if (
    lowerMessage.includes('user already registered') ||
    lowerMessage.includes('already been registered')
  ) {
    return 'Un compte existe déjà avec cette adresse email.';
  }

  if (lowerMessage.includes('password should be')) {
    return 'Le mot de passe est trop court (6 caractères minimum).';
  }

  if (lowerMessage.includes('rate limit')) {
    return 'Trop de tentatives. Attends quelques minutes.';
  }

  if (lowerMessage.includes('unable to validate email')) {
    return 'Cette adresse email semble invalide.';
  }

  if (
    lowerMessage.includes('failed to fetch') ||
    lowerMessage.includes('networkerror')
  ) {
    return 'Connexion au serveur impossible. Vérifie ta connexion internet.';
  }

  return message || 'Une erreur inconnue est survenue.';
}
// ─────────────────────────────────────────────
// 8. CHARGEMENT DES LIEUX
// ─────────────────────────────────────────────

async function loadPlaces() {
  const userId = getCurrentUserId();

  if (!state.supabase || !userId) {
    state.places = [];
    state.filtered = [];
    renderTable();
    updateCount();
    return;
  }

  setStatus('Chargement…');

  try {
    const { data, error } = await state.supabase
      .from('places')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    state.places = data || [];
    applyFilters();
    updateCount();
    updateUserDisplay();
    setStatus('Prêt');
  } catch (error) {
    console.error('Erreur loadPlaces :', error);
    showToast(
      'Erreur de chargement : ' + error.message,
      'error'
    );
    setStatus('Erreur de chargement');
  }
}

// ─────────────────────────────────────────────
// 9. AJOUT ET MODIFICATION
// ─────────────────────────────────────────────

async function handleFormSubmit(event) {
  event.preventDefault();

  const userId = getCurrentUserId();

  if (!state.supabase || !userId) {
    showToast(
      'Ta session a expiré. Reconnecte-toi.',
      'error'
    );
    showScreen('auth');
    return;
  }

  const data = getFormData();

  if (!data.name) {
    showToast('Le nom est obligatoire.', 'error');
    return;
  }

  if (!data.city) {
    showToast('La ville est obligatoire.', 'error');
    return;
  }

  const latitude = parseOptionalNumber(data.latitude);
  const longitude = parseOptionalNumber(data.longitude);
  const surface = parseOptionalNumber(data.surface);
  const rent = parseOptionalNumber(data.rent);

  if (latitude !== null && (latitude < -90 || latitude > 90)) {
    showToast('La latitude doit être comprise entre -90 et 90.', 'error');
    return;
  }

  if (
    longitude !== null &&
    (longitude < -180 || longitude > 180)
  ) {
    showToast(
      'La longitude doit être comprise entre -180 et 180.',
      'error'
    );
    return;
  }

  const payload = {
  owner_id: userId,
  name: data.name,
  type: data.type || 'other',
  description: data.description || null,
  address: data.address || null,
  city: data.city,
  postal_code: data.postalCode || null,
  country: data.country || 'France',
  latitude,
  longitude,
  contact_email: data.contactEmail || null,
  phone: data.phone || null,
  website: data.website || null,
  status: data.status || 'prospect',
  priority: data.priority || 'low',
  surface_m2: surface,
  rent_monthly: rent,
  favorite: Boolean(data.favorite),
  notes: data.notes || null,
  tags: data.tags || null,
  next_date: data.nextDate || null
};

  const saveButton = document.getElementById('btn-save');
  const originalText = saveButton?.textContent;

  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = 'Enregistrement…';
  }

  setStatus('Enregistrement…');

  try {
    let query;

    if (state.editId) {
      query = state.supabase
        .from('places')
        .update(payload)
        .eq('id', state.editId)
        .eq('owner_id', userId);
    } else {
      query = state.supabase
        .from('places')
        .insert(payload);
    }

    const { error } = await query;

    if (error) throw error;

    showToast(
      state.editId
        ? 'Lieu mis à jour.'
        : 'Lieu ajouté.',
      'success'
    );

    closeModal();
    await loadPlaces();
  } catch (error) {
    console.error('Erreur savePlace :', error);
    showToast('Erreur : ' + error.message, 'error');
    setStatus('Erreur');
  } finally {
    if (saveButton) {
      saveButton.disabled = false;
      saveButton.textContent = originalText || 'Enregistrer';
    }
  }
}

async function deleteCurrentPlace() {
  const userId = getCurrentUserId();

  if (!state.editId || !userId || !state.supabase) return;

  const confirmed = window.confirm(
    'Veux-tu vraiment supprimer ce lieu ?'
  );

  if (!confirmed) return;

  setStatus('Suppression…');

  try {
    const { error } = await state.supabase
      .from('places')
      .delete()
      .eq('id', state.editId)
      .eq('owner_id', userId);

    if (error) throw error;

    showToast('Lieu supprimé.', 'success');
    closeModal();
    await loadPlaces();
  } catch (error) {
    console.error('Erreur suppression :', error);
    showToast('Erreur : ' + error.message, 'error');
    setStatus('Erreur');
  }
}

async function quickToggleFav(id) {
  const userId = getCurrentUserId();
  const place = state.places.find(item => String(item.id) === String(id));

  if (!place || !userId || !state.supabase) return;

  try {
    const newValue = !place.favorite;

    const { error } = await state.supabase
      .from('places')
      .update({ favorite: newValue })
      .eq('id', id)
      .eq('owner_id', userId);

    if (error) throw error;

    place.favorite = newValue;
    applyFilters();

    showToast(
      newValue
        ? 'Ajouté aux favoris.'
        : 'Retiré des favoris.',
      'success'
    );
  } catch (error) {
    console.error('Erreur favori :', error);
    showToast('Erreur : ' + error.message, 'error');
  }
}

// ─────────────────────────────────────────────
// 10. MODALE
// ─────────────────────────────────────────────

function openModal(id = null) {
  const modal = document.getElementById('place-modal');
  const form = document.getElementById('place-form');
  const title = document.getElementById('modal-title');
  const deleteButton = document.getElementById('btn-delete');

  if (!modal || !form) return;

  state.editId = id ? String(id) : null;

  form.reset();
  clearGeoFields();
  setFieldValue('place-country', 'France');
  setCheckboxValue('place-favorite', false);

  if (state.editId) {
    const place = state.places.find(
      item => String(item.id) === state.editId
    );

    if (!place) {
      showToast('Lieu introuvable.', 'error');
      state.editId = null;
      return;
    }

    if (title) title.textContent = 'Modifier un lieu';
    deleteButton?.classList.remove('hidden');
    populateForm(place);
  } else {
    if (title) title.textContent = 'Ajouter un lieu';
    deleteButton?.classList.add('hidden');
  }

  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');

  window.setTimeout(() => {
    document.getElementById('place-name')?.focus();
  }, 50);
}

function closeModal() {
  document.getElementById('place-modal')?.classList.add('hidden');
  document.body.classList.remove('modal-open');
  state.editId = null;
}

function populateForm(place) {
  setFieldValue('place-name', place.name);
  setFieldValue('place-type', place.type || 'other');
  setFieldValue('place-description', place.description);
  setFieldValue('place-address', place.address);
  setFieldValue('place-city', place.city);
  setFieldValue('place-postal', place.postal_code);
  setFieldValue('place-country', place.country || 'France');
  setFieldValue('place-lat', place.latitude);
  setFieldValue('place-lng', place.longitude);
  setFieldValue('place-email', place.contact_email);
  setFieldValue('place-phone', place.phone);
  setFieldValue('place-website', place.website);
  setFieldValue('place-status', place.status || 'prospect');
  setFieldValue('place-priority', place.priority || 'low');
  setFieldValue('place-surface', place.surface_m2);
  setFieldValue('place-rent', place.rent_monthly);
  setFieldValue('place-notes', place.notes);
  setFieldValue('place-tags', place.tags);
  setFieldValue('place-next-date', formatDateInput(place.next_date));
  setCheckboxValue('place-favorite', place.favorite);
}

function getFormData() {
  return {
    name: getFieldValue('place-name'),
    type: getFieldValue('place-type'),
    description: getFieldValue('place-description'),
    address: getFieldValue('place-address'),
    city: getFieldValue('place-city'),
    postalCode: getFieldValue('place-postal'),
    country: getFieldValue('place-country'),
    latitude: getFieldValue('place-lat'),
    longitude: getFieldValue('place-lng'),
    contactEmail: getFieldValue('place-email'),
    phone: getFieldValue('place-phone'),
    website: getFieldValue('place-website'),
    status: getFieldValue('place-status'),
    priority: getFieldValue('place-priority'),
    surface: getFieldValue('place-surface'),
    rent: getFieldValue('place-rent'),
    favorite:
      document.getElementById('place-favorite')?.checked === true,
    notes: getFieldValue('place-notes'),
    tags: getFieldValue('place-tags'),
    nextDate: getFieldValue('place-next-date')
  };
}

function getFieldValue(id) {
  return document.getElementById(id)?.value?.trim() || '';
}

function setFieldValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value ?? '';
}

function setCheckboxValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.checked = Boolean(value);
}

function clearGeoFields() {
  setFieldValue('place-lat', '');
  setFieldValue('place-lng', '');
}

// ─────────────────────────────────────────────
// 11. FILTRES ET TABLEAU
// ─────────────────────────────────────────────

function applyFilters() {
  const type = getFieldValue('filter-type');
  const status = getFieldValue('filter-status');
  const search = getFieldValue('search-input').toLowerCase();

  state.filtered = state.places.filter(place => {
    if (type && place.type !== type) return false;
    if (status && place.status !== status) return false;

    if (search) {
      const searchableText = [
        place.name,
        place.city,
        place.address,
        place.postal_code,
        place.description,
        place.tags,
        place.notes
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!searchableText.includes(search)) {
        return false;
      }
    }

    return true;
  });

  renderTable();
  renderMarkers();
}

function renderTable() {
  const tbody = document.getElementById('places-tbody');
  if (!tbody) return;

  if (state.filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td
          colspan="6"
          style="text-align:center;color:var(--text-muted);padding:24px"
        >
          ${
            state.places.length
              ? 'Aucun lieu ne correspond aux filtres.'
              : 'Aucun lieu — ajoute ton premier lieu.'
          }
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.filtered
    .map(place => {
      const id = escAttribute(place.id);

      return `
        <tr data-id="${id}">
          <td class="td-name">
            ${place.favorite ? '⭐ ' : ''}
            ${escHtml(place.name || '—')}
          </td>

          <td>${badgeType(place.type)}</td>

          <td>${escHtml(place.city || '—')}</td>

          <td>${badgeStatus(place.status)}</td>

          <td class="td-fav">
            ${place.favorite ? '⭐' : ''}
          </td>

          <td class="action-btns">
            <button
              type="button"
              onclick="openModal('${id}')"
              title="Modifier"
            >
              ✏️
            </button>

            <button
              type="button"
              onclick="quickToggleFav('${id}')"
              title="Favori"
            >
              ${place.favorite ? '☆' : '⭐'}
            </button>
          </td>
        </tr>
      `;
    })
    .join('');
}

// ─────────────────────────────────────────────
// 12. AFFICHAGE CARTE
// ─────────────────────────────────────────────

function switchView(view = 'map') {
  if (view instanceof Event) {
    view = view.target?.value || 'map';
  }

  view = view === 'list' ? 'list' : 'map';
  state.currentView = view;

  const showMap = view === 'map';
  const listView = document.getElementById('view-list');
  const mapView = document.getElementById('view-map');

  document.querySelectorAll('.view-btn').forEach(button => {
    const isActive = button.dataset.view === view;

    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  listView?.classList.toggle('hidden', showMap);
  listView?.classList.toggle('active', !showMap);

  mapView?.classList.toggle('hidden', !showMap);
  mapView?.classList.toggle('active', showMap);

  // Compatibilité avec l’ancien select
  const oldSelector = document.getElementById('filter-view');
  if (oldSelector) oldSelector.value = view;

  if (!showMap) return;

  if (!state.map) {
    initMap();
  }

  window.setTimeout(() => {
    state.map?.invalidateSize({
      animate: false,
      pan: false
    });

    renderMarkers();
  }, 150);
}

function createTileLayers() {
  if (!window.L) return {};

  return {
    dark: window.L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
      }
    ),

    standard: window.L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }
    ),

    light: window.L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
      }
    ),

    relief: window.L.tileLayer(
      'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      {
        attribution:
          'Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap',
        maxZoom: 17
      }
    ),

    satellite: window.L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/' +
      'World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution:
          'Tiles &copy; Esri — Sources: Esri, Maxar, Earthstar Geographics',
        maxZoom: 19
      }
    )
  };
}

function initMap() {
  const mapElement = document.getElementById('map');

  if (!mapElement || state.map) return;

  if (!window.L) {
    showToast(
      'Leaflet ne s’est pas chargé. Vérifie index.html.',
      'error'
    );
    return;
  }

  state.tileLayers = createTileLayers();

  const requestedStyle =
    document.getElementById('map-style')?.value ||
    state.mapStyle ||
    'dark';

  state.mapStyle = state.tileLayers[requestedStyle]
    ? requestedStyle
    : 'dark';

  state.activeTileLayer =
    state.tileLayers[state.mapStyle] ||
    state.tileLayers.standard;

  state.map = window.L.map(mapElement, {
    center: [46.6034, 2.5],
    zoom: 6,
    zoomControl: true,
    layers: [state.activeTileLayer]
  });

  state.mapClickHandler = event => {
    if (state.mapMode !== 'pointer') return;

    const latitude = event.latlng.lat;
    const longitude = event.latlng.lng;

    const latitudeValue = latitude.toFixed(6);
    const longitudeValue = longitude.toFixed(6);

    const modal = document.getElementById('place-modal');
    const modalIsClosed =
      !modal || modal.classList.contains('hidden');

    if (modalIsClosed) {
      openModal(null);
    }

    setFieldValue('place-lat', latitudeValue);
    setFieldValue('place-lng', longitudeValue);

    showCoordTooltip(latitude, longitude);
    showToast('Coordonnées ajoutées au formulaire.', 'success');
  };

  state.map.on('click', state.mapClickHandler);

  state.map.whenReady(() => {
    state.map.invalidateSize();
    renderMarkers();
  });
}

function changeMapStyle(style) {
  if (!state.map) {
    state.mapStyle = style;
    initMap();
    return;
  }

  const newLayer = state.tileLayers[style];

  if (!newLayer) {
    showToast('Ce fond de carte est indisponible.', 'error');
    return;
  }

  if (
    state.activeTileLayer &&
    state.map.hasLayer(state.activeTileLayer)
  ) {
    state.map.removeLayer(state.activeTileLayer);
  }

  state.activeTileLayer = newLayer;
  state.mapStyle = style;

  newLayer.addTo(state.map);

  try {
    localStorage.setItem('cultural-map-style', style);
  } catch {
    // localStorage indisponible
  }

  window.setTimeout(() => {
    state.map?.invalidateSize();
  }, 50);
}

function restoreMapStyle() {
  let savedStyle = 'dark';

  try {
    savedStyle =
      localStorage.getItem('cultural-map-style') || 'dark';
  } catch {
    savedStyle = 'dark';
  }

  const selector = document.getElementById('map-style');

  if (selector) {
    const optionExists = Array.from(selector.options).some(
      option => option.value === savedStyle
    );

    selector.value = optionExists ? savedStyle : 'dark';
    state.mapStyle = selector.value;
  }
}

function renderMarkers() {
  if (!state.map || !window.L) return;

  state.markers.forEach(marker => {
    marker.remove();
  });

  state.markers = [];

  const bounds = window.L.latLngBounds([]);

  state.filtered.forEach(place => {
    const latitude = parseOptionalNumber(place.latitude);
    const longitude = parseOptionalNumber(place.longitude);

    if (
      latitude === null ||
      longitude === null ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return;
    }

    const marker = window.L.marker(
      [latitude, longitude],
      {
        title: place.name || 'Lieu'
      }
    );

    marker
      .bindPopup(buildPopupHTML(place), {
        maxWidth: 280
      })
      .addTo(state.map);

    state.markers.push(marker);
    bounds.extend([latitude, longitude]);
  });

  state.markersBounds = bounds.isValid() ? bounds : null;
}

function buildPopupHTML(place) {
  const id = escAttribute(place.id);
  const t = typeBySlug(place.type);

  const typeLabel = t?.label || place.type || 'Autre';
  const typeIcon = t?.icon || '📍';
  const typeColor = t?.color || '#bdc6d3';

  const status =
    STATUS_LABELS[place.status] || place.status || 'Prospect';

  return `
    <article class="map-popup">
      <strong>${place.favorite ? '⭐ ' : ''}${escHtml(place.name || 'Lieu')}</strong>

      <p>
        <span style="color:${escAttribute(typeColor)}">
          ${escHtml(typeIcon)} ${escHtml(typeLabel)}
        </span><br>
        ${escHtml(place.city || '')}
      </p>

      <small>${escHtml(status)}</small>

      <div style="margin-top:10px">
        <button
          type="button"
          class="btn-primary"
          onclick="openModal('${id}')"
          style="padding:6px 10px;font-size:12px"
        >
          ✏️ Modifier
        </button>
      </div>
    </article>
  `;
}

function centerOnFrance() {
  switchView('map');

  if (!state.map) {
    initMap();
  }

  state.map?.setView([46.6034, 2.5], 6);
}

function fitMarkers() {
  switchView('map');

  if (!state.map) {
    initMap();
  }

  if (!state.map || !state.markersBounds) {
    showToast(
      'Aucun lieu ne possède de coordonnées.',
      'error'
    );
    return;
  }

  state.map.fitBounds(state.markersBounds, {
    padding: [40, 40],
    maxZoom: 14
  });
}

function goToMyLocation() {
  switchView('map');

  if (!state.map) {
    initMap();
  }

  if (!state.map) return;

  if (!navigator.geolocation) {
    showToast(
      'La géolocalisation n’est pas disponible.',
      'error'
    );
    return;
  }

  setStatus('Recherche de la position…');
  showToast('Recherche de ta position…');

  navigator.geolocation.getCurrentPosition(
    position => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      const accuracy = position.coords.accuracy;

      state.map.setView([latitude, longitude], 15);

      state.userLocationMarker?.remove();

      state.userLocationMarker = window.L
        .circleMarker([latitude, longitude], {
          radius: 9,
          color: '#ffffff',
          weight: 3,
          fillColor: '#2563eb',
          fillOpacity: 1
        })
        .addTo(state.map)
        .bindPopup(
          `📍 Ta position<br><small>Précision : environ ${Math.round(
            accuracy
          )} m</small>`
        )
        .openPopup();

      setStatus('Prêt');
      showToast('Position trouvée.', 'success');
    },
    error => {
      console.error('Erreur géolocalisation :', error);

      let message = 'Position inaccessible.';

      if (error.code === 1) {
        message =
          'Autorisation de géolocalisation refusée.';
      } else if (error.code === 2) {
        message =
          'Ta position n’a pas pu être déterminée.';
      } else if (error.code === 3) {
        message =
          'La recherche de position a expiré.';
      }

      setStatus('Prêt');
      showToast(message, 'error');
    },
    {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 60000
    }
  );
}

function togglePointerMode() {
  state.mapMode =
    state.mapMode === 'pointer'
      ? 'browse'
      : 'pointer';

  const isPointer = state.mapMode === 'pointer';
  const button = document.getElementById('btn-pointer');
  const label = document.getElementById('map-mode-label');

  button?.classList.toggle('active', isPointer);
  button?.setAttribute('aria-pressed', String(isPointer));

  if (label) {
    label.textContent = isPointer
      ? 'Mode pointer : actif'
      : 'Mode navigation : actif';
  }

  const mapContainer = state.map?.getContainer();

  if (mapContainer) {
    mapContainer.style.cursor = isPointer
      ? 'crosshair'
      : '';
  }

  showToast(
    isPointer
      ? 'Mode pointer activé.'
      : 'Mode navigation activé.',
    'success'
  );
}

function showCoordTooltip(latitude, longitude) {
  const tooltip = document.getElementById('coord-tooltip');
  if (!tooltip) return;

  tooltip.textContent =
    `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

  tooltip.classList.remove('hidden');

  window.clearTimeout(tooltip.hideTimer);

  tooltip.hideTimer = window.setTimeout(() => {
    tooltip.classList.add('hidden');
  }, 3000);
}

// ─────────────────────────────────────────────
// 13. HELPERS
// ─────────────────────────────────────────────

function getCurrentUserId() {
  return state.session?.user?.id || null;
}

function updateUserDisplay() {
  const element = document.getElementById('user-email');

  if (element) {
    element.textContent =
      state.session?.user?.email || '';
  }
}

function updateCount() {
  const element = document.getElementById('places-count');
  if (!element) return;

  const count = state.places.length;

  element.textContent =
    `${count} lieu${count > 1 ? 'x' : ''}`;
}

function badgeType(type) {
  const t = typeBySlug(type);
  const label = t?.label || type || 'Autre';
  const color = t?.color || '#bdc6d3';
  const icon = t?.icon || '';

  return `<span class="badge-type"
    style="background:${escAttribute(color)}22;color:${escAttribute(color)};border:1px solid ${escAttribute(color)}55">
    ${escHtml(icon)} ${escHtml(label)}</span>`;
}

function badgeStatus(status) {
  const safeStatus = /^[a-z-]+$/i.test(status || '')
    ? status
    : 'prospect';

  const label =
    STATUS_LABELS[status] || status || 'Prospect';

  return `
    <span class="badge-status status-${safeStatus}">
      ${escHtml(label)}
    </span>
  `;
}

function parseOptionalNumber(value) {
  if (
    value === '' ||
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const normalized = String(value).replace(',', '.');
  const number = Number(normalized);

  return Number.isFinite(number) ? number : null;
}

function formatDateInput(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function escHtml(value) {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

function escAttribute(value) {
  return escHtml(value).replace(/`/g, '&#096;');
}

function debounce(callback, delay) {
  let timer;

  return (...args) => {
    clearTimeout(timer);

    timer = window.setTimeout(() => {
      callback(...args);
    }, delay);
  };
}

function setStatus(message) {
  const element = document.getElementById('status-msg');

  if (element) {
    element.textContent = message;
  }
}

function showToast(message, type = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');

  toast.className = type
    ? `toast ${type}`
    : 'toast';

  toast.textContent = message;
  container.appendChild(toast);

  window.setTimeout(() => {
    toast.style.opacity = '0';

    window.setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// Fonctions accessibles depuis les boutons HTML générés
window.openModal = openModal;
window.quickToggleFav = quickToggleFav;
window.switchView = switchView;
window.changeMapStyle = changeMapStyle;
