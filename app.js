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

  map: null,
  markers: [],
  markersBounds: null,
  userLocationMarker: null,
  mapClickHandler: null,
  mapMode: 'pointer',

  authMode: 'login',
  initialized: false
};

// ─────────────────────────────────────────────
// 3. LIBELLÉS
// ─────────────────────────────────────────────

const TYPE_LABELS = {
  gallery: 'Galerie d\'art',
  museum: 'Musée',
  theater: 'Théâtre',
  concert: 'Salle de concert',
  library: 'Bibliothèque',
  cinema: 'Cinéma',
  other: 'Autre'
};

const STATUS_LABELS = {
  prospect: 'Prospect',
  contacted: 'Contacté',
  contracted: 'Sous contrat',
  archived: 'Archivé'
};

// ─────────────────────────────────────────────
// 4. DÉMARRAGE
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', startApp);

async function startApp() {
  if (state.initialized) return;

  state.initialized = true;
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
    window.setTimeout(() => {
      state.map?.invalidateSize();
    }, 100);
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
    .getElementById('filter-view')
    ?.addEventListener('change', switchView);

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

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeModal();
    }
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
  const nameInput = document.getElementById('auth-name');
  const nameLabel = document.getElementById('label-name');

  if (submitButton) {
    submitButton.textContent = isRegister
      ? 'Inscription'
      : 'Connexion';
  }

  nameInput?.classList.toggle('hidden', !isRegister);
  nameLabel?.classList.toggle('hidden', !isRegister);

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

  const email = document
    .getElementById('auth-email')
    ?.value.trim();

  const password =
    document.getElementById('auth-password')?.value || '';

  const fullName = document
    .getElementById('auth-name')
    ?.value.trim();

  if (!email || !password) {
    showAuthError('L’email et le mot de passe sont obligatoires.');
    return;
  }

  if (password.length < 6) {
    showAuthError(
      'Le mot de passe doit contenir au moins 6 caractères.'
    );
    return;
  }

  const submitButton = document.getElementById('auth-submit');
  const originalText = submitButton?.textContent;

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
          data: {
            full_name: fullName || ''
          }
        }
      });

      if (error) throw error;

      if (data.session) {
        state.session = data.session;
        showToast('Compte créé et connecté.', 'success');
        showScreen('app');
        await loadPlaces();
      } else {
        showToast(
          'Compte créé. Vérifie ton email pour confirmer ton inscription.',
          'success'
        );

        setAuthMode('login');
      }
    } else {
      const { data, error } =
        await state.supabase.auth.signInWithPassword({
          email,
          password
        });

      if (error) throw error;

      if (!data.session) {
        throw new Error('Aucune session reçue après la connexion.');
      }

      state.session = data.session;
      showScreen('app');
      updateUserDisplay();
      await loadPlaces();

      showToast('Connexion réussie.', 'success');
    }
  } catch (error) {
    console.error('Erreur authentification :', error);
    showAuthError(translateAuthError(error.message));
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent =
        state.authMode === 'register'
          ? 'Inscription'
          : 'Connexion';
    }

    if (originalText && !submitButton?.textContent) {
      submitButton.textContent = originalText;
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
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('invalid login credentials')) {
    return 'Email ou mot de passe incorrect.';
  }

  if (lowerMessage.includes('email not confirmed')) {
    return 'Tu dois confirmer ton adresse email avant de te connecter.';
  }

  if (lowerMessage.includes('user already registered')) {
    return 'Un compte existe déjà avec cette adresse email.';
  }

  if (lowerMessage.includes('password should be')) {
    return 'Le mot de passe est trop court.';
  }

  if (lowerMessage.includes('rate limit')) {
    return 'Trop de tentatives. Attends quelques minutes.';
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
    favorite: data.favorite,
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

function switchView() {
  const selectedView =
    document.getElementById('filter-view')?.value || 'list';

  const listView = document.getElementById('view-list');
  const mapView = document.getElementById('view-map');

  const showMap = selectedView === 'map';

  listView?.classList.toggle('hidden', showMap);
  mapView?.classList.toggle('hidden', !showMap);

  listView?.classList.toggle('active', !showMap);
  mapView?.classList.toggle('active', showMap);

  if (showMap) {
    if (!state.map) {
      initMap();
    }

    window.setTimeout(() => {
      state.map?.invalidateSize();
      renderMarkers();
    }, 150);
  }
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

  state.map = window.L
    .map('map', {
      zoomControl: true
    })
    .setView([46.6034, 2.5], 6);

  window.L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    }
  ).addTo(state.map);

  state.mapClickHandler = event => {
    if (state.mapMode !== 'pointer') return;

    const { lat, lng } = event.latlng;

    setFieldValue('place-lat', lat.toFixed(6));
    setFieldValue('place-lng', lng.toFixed(6));

    showCoordTooltip(lat, lng);

    if (
      document
        .getElementById('place-modal')
        ?.classList.contains('hidden')
    ) {
      openModal(null);
      setFieldValue('place-lat', lat.toFixed(6));
      setFieldValue('place-lng', lng.toFixed(6));
    }
  };

  state.map.on('click', state.mapClickHandler);

  state.map.whenReady(() => {
    state.map.invalidateSize();
    renderMarkers();
  });
}

function renderMarkers() {
  if (!state.map || !window.L) return;

  state.markers.forEach(marker => {
    state.map.removeLayer(marker);
  });

  state.markers = [];

  const bounds = window.L.latLngBounds([]);

  state.filtered.forEach(place => {
    const latitude = Number(place.latitude);
    const longitude = Number(place.longitude);

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return;
    }

    const marker = window.L
      .marker([latitude, longitude])
      .addTo(state.map)
      .bindPopup(buildPopupHTML(place));

    state.markers.push(marker);
    bounds.extend([latitude, longitude]);
  });

  state.markersBounds = bounds.isValid() ? bounds : null;
}

function buildPopupHTML(place) {
  const id = escAttribute(place.id);

  return `
    <div>
      <strong>${escHtml(place.name || 'Lieu')}</strong><br>

      <span style="font-size:12px">
        ${escHtml(place.city || '')}
      </span><br>

      <span style="font-size:11px">
        ${escHtml(TYPE_LABELS[place.type] || place.type || 'Autre')}
      </span>

      <div style="margin-top:8px">
        <button
          type="button"
          onclick="openModal('${id}')"
          style="
            background:#2563eb;
            color:#fff;
            border:none;
            border-radius:4px;
            padding:5px 10px;
            cursor:pointer;
          "
        >
          Modifier
        </button>
      </div>
    </div>
  `;
}

function centerOnFrance() {
  if (!state.map) {
    initMap();
  }

  state.map?.setView([46.6034, 2.5], 6);
}

function fitMarkers() {
  if (!state.map) {
    initMap();
  }

  if (!state.map || !state.markersBounds) {
    showToast(
      'Aucun lieu avec des coordonnées.',
      'error'
    );
    return;
  }

  state.map.fitBounds(state.markersBounds, {
    padding: [40, 40],
    maxZoom: 13
  });
}

function goToMyLocation() {
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

  showToast('Recherche de ta position…');

  navigator.geolocation.getCurrentPosition(
    position => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      state.map.setView([latitude, longitude], 14);

      if (state.userLocationMarker) {
        state.map.removeLayer(state.userLocationMarker);
      }

      state.userLocationMarker = window.L
        .marker([latitude, longitude])
        .addTo(state.map)
        .bindPopup('📍 Ta position')
        .openPopup();

      showToast('Position trouvée.', 'success');
    },
    error => {
      console.error('Erreur géolocalisation :', error);
      showToast(
        'Position inaccessible. Vérifie les autorisations.',
        'error'
      );
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    }
  );
}

function togglePointerMode() {
  const button = document.getElementById('btn-pointer');
  const label = document.getElementById('map-mode-label');

  if (state.mapMode === 'pointer') {
    state.mapMode = 'browse';

    button?.classList.remove('active');

    if (label) {
      label.textContent = 'Mode pointer : inactif';
    }

    if (state.map && state.mapClickHandler) {
      state.map.off('click', state.mapClickHandler);
    }
  } else {
    state.mapMode = 'pointer';

    button?.classList.add('active');

    if (label) {
      label.textContent = 'Mode pointer : actif';
    }

    if (state.map && state.mapClickHandler) {
      state.map.off('click', state.mapClickHandler);
      state.map.on('click', state.mapClickHandler);
    }
  }
}

function showCoordTooltip(latitude, longitude) {
  const tooltip = document.getElementById('coord-tooltip');
  if (!tooltip) return;

  tooltip.textContent =
    `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

  tooltip.classList.remove('hidden');

  clearTimeout(tooltip.hideTimer);

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
  const safeType = /^[a-z-]+$/i.test(type || '')
    ? type
    : 'other';

  const label = TYPE_LABELS[type] || type || 'Autre';

  return `
    <span class="badge-type type-${safeType}">
      ${escHtml(label)}
    </span>
  `;
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
