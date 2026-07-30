/* ============================================
   Cultural Places Scout — app.js
   Vanilla JS, Supabase v2, Leaflet CDN
   ============================================ */

'use strict';

// ─────────────────────────────────────────────
// 1. CONFIGURATION SUPABASE
// Ne jamais ajouter /rest/v1/ à cette URL.
// ─────────────────────────────────────────────

const SUPABASE_URL =
  'https://hawimjftwmrwljkjsnzu.supabase.co';

const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhhd2ltamZ0d21yd2xqa2pzbnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMjk4MTIsImV4cCI6MjEwMDgwNTgxMn0.Ej-PlxrKOd8cL9m3yQfIh3H9AvvDjY_d2xWGZskCz1s';

let db = null;

// ─────────────────────────────────────────────
// 2. ÉTAT DE L’APPLICATION
// ─────────────────────────────────────────────

let map = null;
let markers = [];
let places = [];
let editingId = null;
let currentView = 'list';
let favoritesOnly = false;
let currentUser = null;

// ─────────────────────────────────────────────
// 3. CONSTANTES
// ─────────────────────────────────────────────

const FRANCE_CENTER = [46.603354, 1.888334];
const FRANCE_ZOOM = 6;

const TYPE_LABELS = {
  gallery: 'Galerie',
  museum: 'Musée',
  theater: 'Théâtre',
  concert: 'Concert',
  cultural_center: 'Centre culturel',
  library: 'Bibliothèque',
  cinema: 'Cinéma',
  other: 'Autre'
};

const STATUS_LABELS = {
  prospect: 'Prospect',
  contacted: 'Contacté',
  negotiating: 'En négociation',
  contracted: 'Contrat',
  archived: 'Archivé'
};

// ─────────────────────────────────────────────
// 4. HELPERS
// ─────────────────────────────────────────────

function getElement(id) {
  return document.getElementById(id);
}

function showToast(message, type = 'info') {
  const container = getElement('toast-container');

  if (!container) {
    console.log(`[${type}] ${message}`);
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 4000);
}

function setLoading(button, loading) {
  if (!button) return;

  if (loading) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }

    button.disabled = true;
    button.textContent = '…';
  } else {
    button.disabled = false;
    button.textContent =
      button.dataset.originalText || button.textContent;

    delete button.dataset.originalText;
  }
}

function esc(value) {
  if (value === null || value === undefined) return '';

  const div = document.createElement('div');
  div.textContent = String(value);

  return div.innerHTML;
}

function safeUrl(url) {
  if (!url) return null;

  try {
    const value = String(url).trim();

    if (!value) return null;

    const normalized =
      value.startsWith('http://') ||
      value.startsWith('https://')
        ? value
        : `https://${value}`;

    const parsed = new URL(normalized);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    return parsed.href;
  } catch {
    return null;
  }
}

function setStatus(message) {
  const element = getElement('status-msg');

  if (element) {
    element.textContent = message;
  }
}

function refreshViews() {
  renderPlaces();

  if (currentView === 'map' && map) {
    renderMarkers();
  }
}

function bindIfExists(id, eventName, callback) {
  const element = getElement(id);

  if (element) {
    element.addEventListener(eventName, callback);
  }
}

function normalizeNullableNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function requireCurrentUser() {
  if (!currentUser?.id) {
    throw new Error(
      'Session expirée. Déconnecte-toi puis reconnecte-toi.'
    );
  }

  return currentUser;
}

// ─────────────────────────────────────────────
// 5. INITIALISATION
// ─────────────────────────────────────────────

document.addEventListener(
  'DOMContentLoaded',
  initializeApplication
);

async function initializeApplication() {
  if (!window.supabase?.createClient) {
    showSetupError(
      'Supabase JS n’a pas été chargé. Vérifie le script CDN dans index.html.'
    );
    return;
  }

  if (!window.L) {
    showSetupError(
      'Leaflet n’a pas été chargé. Vérifie le script Leaflet dans index.html.'
    );
    return;
  }

  if (
    !SUPABASE_URL.startsWith('https://') ||
    SUPABASE_URL.includes('/rest/v1')
  ) {
    showSetupError('L’URL Supabase est incorrecte.');
    return;
  }

  db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  bindAuth();
  bindPlaces();
  bindMap();

  await restoreSession();
}

function showSetupError(message) {
  const banner = getElement('setup-banner');

  if (banner) {
    banner.textContent = message;
    banner.classList.remove('hidden');
  }

  const authBox =
    getElement('auth-screen')?.querySelector('.auth-box');

  if (authBox) {
    authBox.innerHTML = `
      <p style="color:#f85149;text-align:center">
        ❌ ${esc(message)}
      </p>
    `;
  }

  console.error(message);
}

// ─────────────────────────────────────────────
// 6. AUTHENTIFICATION
// ─────────────────────────────────────────────

async function restoreSession() {
  showScreen('auth');

  try {
    const { data, error } = await db.auth.getSession();

    if (error) throw error;

    if (data?.session?.user) {
      await onAuthSuccess(data.session.user);
    }
  } catch (error) {
    console.error(error);

    showToast(
      `Erreur de session : ${error.message || error}`,
      'error'
    );
  }

  db.auth.onAuthStateChange((event, session) => {
    window.setTimeout(async () => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        onLogout();
        return;
      }

      if (
        event === 'SIGNED_IN' ||
        event === 'USER_UPDATED'
      ) {
        await onAuthSuccess(session.user);
      }
    }, 0);
  });
}

async function onAuthSuccess(user) {
  if (!user?.id) {
    onLogout();
    return;
  }

  currentUser = user;

  const userEmail = getElement('user-email');

  if (userEmail) {
    userEmail.textContent = user.email || '';
  }

  showScreen('app');
  await loadPlaces();
}

function onLogout() {
  currentUser = null;
  places = [];
  editingId = null;
  favoritesOnly = false;

  clearMarkers();

  const tbody = getElement('places-tbody');
  const userEmail = getElement('user-email');
  const favoriteButton = getElement('btn-my-locations');

  if (tbody) tbody.innerHTML = '';
  if (userEmail) userEmail.textContent = '';

  favoriteButton?.classList.remove('btn-primary');
  favoriteButton?.classList.add('btn-secondary');

  setStatus('');
  showScreen('auth');
  resetAuthForm();
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.add('hidden');
  });

  if (name === 'app') {
    getElement('app-screen')?.classList.remove('hidden');
  }

  if (name === 'auth') {
    getElement('auth-screen')?.classList.remove('hidden');
  }
}

function bindAuth() {
  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((item) => {
        item.classList.remove('active');
      });

      button.classList.add('active');

      const isRegister =
        button.dataset.tab === 'register';

      const submitButton = getElement('auth-submit');
      const confirmGroup = getElement('confirm-group');
      const errorElement = getElement('auth-error');

      if (submitButton) {
        submitButton.textContent = isRegister
          ? 'Créer un compte'
          : 'Connexion';
      }

      if (confirmGroup) {
        confirmGroup.style.display = isRegister
          ? 'flex'
          : 'none';
      }

      errorElement?.classList.add('hidden');
    });
  });

  const authForm = getElement('auth-form');

  authForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const errorElement = getElement('auth-error');
    const submitButton = getElement('auth-submit');

    errorElement?.classList.add('hidden');
    setLoading(submitButton, true);

    const email =
      getElement('auth-email')?.value.trim() || '';

    const password =
      getElement('auth-password')?.value || '';

    const activeTab =
      document.querySelector('.tab-btn.active');

    const isRegister =
      activeTab?.dataset.tab === 'register';

    try {
      if (!email || !password) {
        throw new Error(
          'Email et mot de passe obligatoires.'
        );
      }

      if (password.length < 6) {
        throw new Error(
          'Le mot de passe doit contenir au moins 6 caractères.'
        );
      }

      if (isRegister) {
        const confirmation =
          getElement('auth-confirm')?.value || '';

        if (password !== confirmation) {
          throw new Error(
            'Les mots de passe ne correspondent pas.'
          );
        }

        const { data, error } = await db.auth.signUp({
          email,
          password
        });

        if (error) throw error;

        if (data?.session?.user) {
          currentUser = data.session.user;
        }

        showToast(
          data?.session
            ? 'Compte créé et connexion réussie.'
            : 'Compte créé. Vérifie ton email pour confirmer ton inscription.',
          'success'
        );

        resetAuthForm();
      } else {
        const { data, error } =
          await db.auth.signInWithPassword({
            email,
            password
          });

        if (error) throw error;

        currentUser = data?.user || null;

        showToast('Connexion réussie.', 'success');
      }
    } catch (error) {
      console.error(error);

      if (errorElement) {
        errorElement.textContent =
          error.message || 'Erreur de connexion.';

        errorElement.classList.remove('hidden');
      }
    } finally {
      setLoading(submitButton, false);
    }
  });

  bindIfExists('btn-logout', 'click', async () => {
    try {
      const { error } = await db.auth.signOut();

      if (error) throw error;
    } catch (error) {
      showToast(
        `Erreur : ${error.message || error}`,
        'error'
      );
    }
  });
}

function resetAuthForm() {
  const form = getElement('auth-form');
  const confirmation = getElement('auth-confirm');
  const confirmGroup = getElement('confirm-group');
  const errorElement = getElement('auth-error');
  const submitButton = getElement('auth-submit');

  form?.reset();

  if (confirmation) confirmation.value = '';

  if (confirmGroup) {
    confirmGroup.style.display = 'none';
  }

  errorElement?.classList.add('hidden');

  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.classList.remove('active');
  });

  document
    .querySelector('[data-tab="login"]')
    ?.classList.add('active');

  if (submitButton) {
    submitButton.textContent = 'Connexion';
  }
}

// ─────────────────────────────────────────────
// 7. CARTE LEAFLET
// ─────────────────────────────────────────────

function initMap() {
  const mapElement = getElement('map');

  if (!mapElement) {
    console.error('Élément HTML #map introuvable.');
    showToast(
      'Conteneur de carte introuvable.',
      'error'
    );

    return null;
  }

  if (!window.L) {
    console.error('Leaflet n’est pas chargé.');
    showToast(
      'Impossible de charger Leaflet.',
      'error'
    );

    return null;
  }

  if (map) {
    window.setTimeout(() => {
      map.invalidateSize(true);
    }, 50);

    return map;
  }

  map = window.L.map(mapElement, {
    zoomControl: true,
    attributionControl: true,
    minZoom: 3,
    maxZoom: 19
  });

  map.setView(FRANCE_CENTER, FRANCE_ZOOM);

  window.L
    .tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'
      }
    )
    .addTo(map);

  map.on('click', (event) => {
    const lat = event.latlng.lat.toFixed(6);
    const lng = event.latlng.lng.toFixed(6);

    const latInput = getElement('place-lat');
    const lngInput = getElement('place-lng');

    if (latInput) latInput.value = lat;
    if (lngInput) lngInput.value = lng;

    showCoordinateTooltip(lat, lng);
  });

  window.setTimeout(() => {
    map?.invalidateSize(true);
  }, 150);

  return map;
}

function showCoordinateTooltip(lat, lng) {
  const tooltip = getElement('map-coord-tooltip');

  if (!tooltip) return;

  tooltip.textContent = `📍 ${lat}, ${lng}`;
  tooltip.classList.remove('hidden');

  window.clearTimeout(
    window.coordinateTooltipTimer
  );

  window.coordinateTooltipTimer =
    window.setTimeout(() => {
      tooltip.classList.add('hidden');
    }, 3000);
}

function createMarkerIcon(type) {
  if (!window.L) return undefined;

  const colors = {
    gallery: '#8b5cf6',
    museum: '#3b82f6',
    theater: '#ef4444',
    concert: '#22c55e',
    cultural_center: '#f59e0b',
    library: '#0ea5e9',
    cinema: '#ec4899',
    other: '#6b7280'
  };

  const color = colors[type] || colors.other;

  const svg = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="30"
      height="40"
      viewBox="0 0 30 40"
      aria-hidden="true"
    >
      <path
        d="M15 0C6.716 0 0 6.716 0 15c0 10 15 25 15 25s15-15 15-25C30 6.716 23.284 0 15 0z"
        fill="${color}"
        stroke="#ffffff"
        stroke-width="1.5"
      />
      <circle
        cx="15"
        cy="15"
        r="6"
        fill="#ffffff"
        opacity="0.95"
      />
    </svg>
  `;

  return window.L.divIcon({
    html: svg,
    className: 'custom-marker',
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    popupAnchor: [0, -38]
  });
}

function renderMarkers() {
  if (!map || !window.L) return;

  clearMarkers();

  getFilteredPlaces().forEach((place) => {
    const lat = Number(place.lat);
    const lng = Number(place.lng);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return;
    }

    const marker = window.L
      .marker([lat, lng], {
        icon: createMarkerIcon(place.type),
        title: place.name || 'Lieu culturel'
      })
      .addTo(map);

    marker.bindPopup(createMarkerPopup(place), {
      maxWidth: 320,
      minWidth: 220
    });

    marker.on('popupopen', (event) => {
      const popupElement =
        event.popup.getElement();

      const editButton =
        popupElement?.querySelector(
          '[data-action="edit-place"]'
        );

      if (!editButton) return;

      editButton.addEventListener(
        'click',
        () => {
          openEditModal(String(place.id));
          map.closePopup();
        },
        { once: true }
      );
    });

    markers.push({
      id: String(place.id),
      marker
    });
  });
}

function createMarkerPopup(place) {
  const websiteUrl = safeUrl(place.website);
  const type = place.type || 'other';
  const status = place.status || 'prospect';

  const location = [place.city, place.country]
    .filter(Boolean)
    .map((value) => esc(value))
    .join(', ');

  return `
    <div class="map-popup">
      <strong class="map-popup-title">
        ${esc(place.name || 'Lieu sans nom')}
      </strong>

      ${
        location
          ? `
            <div class="map-popup-location">
              📍 ${location}
            </div>
          `
          : ''
      }

      <div class="map-popup-badges">
        <span class="badge-type ${esc(type)}">
          ${esc(TYPE_LABELS[type] || 'Autre')}
        </span>

        <span class="badge-status ${esc(status)}">
          ${esc(
            STATUS_LABELS[status] || 'Prospect'
          )}
        </span>
      </div>

      ${
        place.favorite
          ? '<div class="map-popup-line">⭐ Favori</div>'
          : ''
      }

      ${
        place.address
          ? `
            <div class="map-popup-line">
              ${esc(place.address)}
            </div>
          `
          : ''
      }

      ${
        place.contact_email
          ? `
            <div class="map-popup-line">
              ✉️
              <a href="mailto:${esc(
                place.contact_email
              )}">
                ${esc(place.contact_email)}
              </a>
            </div>
          `
          : ''
      }

      ${
        place.phone
          ? `
            <div class="map-popup-line">
              ☎️
              <a href="tel:${esc(place.phone)}">
                ${esc(place.phone)}
              </a>
            </div>
          `
          : ''
      }

      ${
        websiteUrl
          ? `
            <div class="map-popup-line">
              🔗
              <a
                href="${esc(websiteUrl)}"
                target="_blank"
                rel="noopener noreferrer"
              >
                Voir le site
              </a>
            </div>
          `
          : ''
      }

      <button
        type="button"
        class="map-popup-edit"
        data-action="edit-place"
      >
        ✏️ Éditer
      </button>
    </div>
  `;
}

function clearMarkers() {
  if (!Array.isArray(markers)) {
    markers = [];
    return;
  }

  markers.forEach((item) => {
    if (
      item?.marker &&
      map?.hasLayer(item.marker)
    ) {
      map.removeLayer(item.marker);
    }
  });

  markers = [];
}

function fitBounds() {
  if (!map) return;

  if (markers.length === 0) {
    map.setView(FRANCE_CENTER, FRANCE_ZOOM);
    return;
  }

  const positions = markers
    .map((item) => item.marker?.getLatLng())
    .filter(Boolean);

  if (positions.length === 0) {
    map.setView(FRANCE_CENTER, FRANCE_ZOOM);
    return;
  }

  if (positions.length === 1) {
    map.setView(positions[0], 13);
    return;
  }

  const bounds =
    window.L.latLngBounds(positions);

  map.fitBounds(bounds, {
    padding: [45, 45],
    maxZoom: 12
  });
}

function showMapView() {
  const mapPanel = getElement('view-map');
  const listPanel = getElement('view-list');

  listPanel?.classList.add('hidden');
  mapPanel?.classList.remove('hidden');

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const leafletMap = initMap();

      if (!leafletMap) return;

      leafletMap.invalidateSize(true);
      renderMarkers();

      window.setTimeout(() => {
        leafletMap.invalidateSize(true);

        if (markers.length > 0) {
          fitBounds();
        } else {
          leafletMap.setView(
            FRANCE_CENTER,
            FRANCE_ZOOM
          );
        }
      }, 150);
    });
  });
}

function showListView() {
  const mapPanel = getElement('view-map');
  const listPanel = getElement('view-list');

  mapPanel?.classList.add('hidden');
  listPanel?.classList.remove('hidden');
}

function bindMap() {
  bindIfExists(
    'btn-fit-markers',
    'click',
    () => {
      map?.invalidateSize(true);
      fitBounds();
    }
  );

  bindIfExists(
    'filter-view',
    'change',
    (event) => {
      currentView = event.target.value;

      if (currentView === 'map') {
        showMapView();
      } else {
        showListView();
      }
    }
  );

  bindIfExists(
    'btn-geolocate',
    'click',
    () => {
      if (!navigator.geolocation) {
        showToast(
          'Géolocalisation non disponible.',
          'error'
        );

        return;
      }

      const geolocationButton =
        getElement('btn-geolocate');

      if (geolocationButton) {
        geolocationButton.disabled = true;
        geolocationButton.textContent =
          '⏳ Localisation…';
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat =
            position.coords.latitude.toFixed(6);

          const lng =
            position.coords.longitude.toFixed(6);

          const latInput =
            getElement('place-lat');

          const lngInput =
            getElement('place-lng');

          if (latInput) latInput.value = lat;
          if (lngInput) lngInput.value = lng;

          showCoordinateTooltip(lat, lng);
          showToast(
            'Position définie.',
            'success'
          );

          if (map && currentView === 'map') {
            map.setView(
              [Number(lat), Number(lng)],
              14
            );
          }

          resetGeolocationButton();
        },
        (error) => {
          let message =
            'Impossible d’obtenir ta position.';

          if (
            error.code === error.PERMISSION_DENIED
          ) {
            message =
              'Autorisation de géolocalisation refusée.';
          } else if (
            error.code ===
            error.POSITION_UNAVAILABLE
          ) {
            message =
              'Position actuellement indisponible.';
          } else if (
            error.code === error.TIMEOUT
          ) {
            message =
              'La géolocalisation a expiré.';
          }

          showToast(message, 'error');
          resetGeolocationButton();
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    }
  );
}

function resetGeolocationButton() {
  const button = getElement('btn-geolocate');

  if (!button) return;

  button.disabled = false;
  button.textContent = '📍 Géolocaliser';
}

// ─────────────────────────────────────────────
// 8. CHARGEMENT ET CRUD
// ─────────────────────────────────────────────

async function loadPlaces() {
  setStatus('Chargement…');

  try {
    const user = requireCurrentUser();

    const { data, error } = await db
      .from('places')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', {
        ascending: false
      });

    if (error) throw error;

    places = Array.isArray(data) ? data : [];

    refreshViews();

    setStatus(
      `${places.length} lieu(x) chargé(s)`
    );
  } catch (error) {
    console.error(
      'Erreur loadPlaces :',
      error
    );

    places = [];
    refreshViews();

    showToast(
      `Erreur de chargement : ${
        error.message || error
      }`,
      'error'
    );

    setStatus('Erreur de chargement');
  }
}

async function savePlace(formData) {
  const saveButton = getElement('btn-save-place');
  const errorElement = getElement('place-form-error');

  setLoading(saveButton, true);
  errorElement?.classList.add('hidden');

  try {
    const user = requireCurrentUser();

    const payload = {
      name: formData.name.trim(),
      type: formData.type || 'other',
      description: formData.description || null,
      address: formData.address || null,
      city: formData.city || null,
      postal_code: formData.postal_code || null,
      country: formData.country || 'France',
      lat: normalizeNullableNumber(formData.lat),
      lng: normalizeNullableNumber(formData.lng),
      contact_email: formData.contact_email || null,
      phone: formData.phone || null,
      website: safeUrl(formData.website) || null,
      tags: formData.tags || null,
      status: formData.status || 'prospect',
      priority: formData.priority || 'medium',
      favorite: Boolean(formData.favorite),
      surface_m2: normalizeNullableNumber(formData.surface_m2),
      rent_monthly: normalizeNullableNumber(formData.rent_monthly),
      notes: formData.notes || null,
      next_action: formData.next_action || null,
      next_date: formData.next_date || null
    };

    if (!payload.name) {
      throw new Error('Le nom est obligatoire.');
    }

    if (editingId) {
      const { data, error } = await db
        .from('places')
        .update(payload)
        .eq('id', editingId)
        .eq('owner_id', user.id)
        .select()
        .single();

      if (error) throw error;

      places = places.map((place) =>
        String(place.id) === String(editingId)
          ? data
          : place
      );

      showToast('Lieu mis à jour.', 'success');
    } else {
      const { data, error } = await db
        .from('places')
        .insert({
          ...payload,
          owner_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      places.unshift(data);
      showToast('Lieu ajouté.', 'success');
    }

    refreshViews();
    closeModal();
  } catch (error) {
    console.error('Erreur savePlace :', error);

    const message =
      error?.message ||
      error?.details ||
      error?.hint ||
      'Erreur inconnue';

    showToast(`Erreur : ${message}`, 'error');

    if (errorElement) {
      errorElement.textContent = message;
      errorElement.classList.remove('hidden');
    }
  } finally {
    setLoading(saveButton, false);
  }
}

async function deletePlace(id) {
  if (!id) return;

  const confirmed = window.confirm(
    'Supprimer définitivement ce lieu ?'
  );

  if (!confirmed) return;

  try {
    const user = requireCurrentUser();

    const { error } = await db
      .from('places')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) throw error;

    places = places.filter(
      (place) =>
        String(place.id) !== String(id)
    );

    refreshViews();
    closeModal();

    showToast(
      'Lieu supprimé.',
      'success'
    );
  } catch (error) {
    console.error(
      'Erreur deletePlace :',
      error
    );

    showToast(
      `Erreur de suppression : ${
        error.message || error
      }`,
      'error'
    );
  }
}

// ─────────────────────────────────────────────
// 9. FILTRES ET AFFICHAGE
// ─────────────────────────────────────────────

function getFilteredPlaces() {
  const search =
    getElement('filter-search')
      ?.value.toLowerCase()
      .trim() || '';

  const type =
    getElement('filter-type')?.value || '';

  const status =
    getElement('filter-status')?.value || '';

  return places.filter((place) => {
    if (favoritesOnly && !place.favorite) {
      return false;
    }

    if (type && place.type !== type) {
      return false;
    }

    if (status && place.status !== status) {
      return false;
    }

    if (search) {
      const content = [
        place.name,
        place.city,
        place.country,
        place.address,
        place.description,
        place.tags,
        place.notes,
        place.contact_email
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (!content.includes(search)) {
        return false;
      }
    }

    return true;
  });
}

function renderPlaces() {
  const filteredPlaces =
    getFilteredPlaces();

  const countElement =
    getElement('place-count');

  const tbody =
    getElement('places-tbody');

  const noPlaces =
    getElement('no-places');

  if (countElement) {
    countElement.textContent =
      `${filteredPlaces.length} / ` +
      `${places.length} lieu(x)`;
  }

  if (!tbody) return;

  if (filteredPlaces.length === 0) {
    tbody.innerHTML = '';
    noPlaces?.classList.remove('hidden');
    return;
  }

  noPlaces?.classList.add('hidden');

  tbody.innerHTML = filteredPlaces
    .map((place) => {
      const websiteUrl =
        safeUrl(place.website);

      const id = esc(String(place.id));

      const favoriteButton = `
        <button
          type="button"
          class="btn-icon ${
            place.favorite
              ? 'active-star'
              : ''
          }"
          onclick="
            event.stopPropagation();
            toggleFavorite('${id}');
          "
          title="Favori"
        >
          ${place.favorite ? '⭐' : '☆'}
        </button>
      `;

      const websiteLink = websiteUrl
        ? `
          <a
            href="${esc(websiteUrl)}"
            target="_blank"
            rel="noopener noreferrer"
            onclick="event.stopPropagation()"
            style="color:#58a6ff"
            title="Ouvrir le site"
          >
            🔗
          </a>
        `
        : '';

      return `
        <tr onclick="openEditModal('${id}')">
          <td class="td-name">
            ${esc(
              place.name || 'Lieu sans nom'
            )}
          </td>

          <td>
            <span
              class="badge-type ${esc(
                place.type || 'other'
              )}"
            >
              ${esc(
                TYPE_LABELS[place.type] ||
                  place.type ||
                  'Autre'
              )}
            </span>
          </td>

          <td class="td-type">
            ${esc(place.city || '')}
          </td>

          <td class="td-status">
            <span
              class="badge-status ${esc(
                place.status || 'prospect'
              )}"
            >
              ${esc(
                STATUS_LABELS[place.status] ||
                  place.status ||
                  'Prospect'
              )}
            </span>
          </td>

          <td class="td-fav">
            ${favoriteButton}
          </td>

          <td class="td-actions">
            <button
              type="button"
              class="btn-secondary"
              onclick="
                event.stopPropagation();
                openEditModal('${id}');
              "
              title="Modifier"
            >
              ✏️
            </button>

            ${websiteLink}
          </td>
        </tr>
      `;
    })
    .join('');
}

async function toggleFavorite(id) {
  const place = places.find(
    (item) =>
      String(item.id) === String(id)
  );

  if (!place) return;

  const previousValue =
    Boolean(place.favorite);

  const favorite = !previousValue;

  try {
    const user = requireCurrentUser();

    place.favorite = favorite;
    refreshViews();

    const { data, error } = await db
      .from('places')
      .update({ favorite })
      .eq('id', id)
      .eq('owner_id', user.id)
      .select()
      .single();

    if (error) throw error;

    places = places.map((item) =>
      String(item.id) === String(id)
        ? data
        : item
    );

    refreshViews();
  } catch (error) {
    place.favorite = previousValue;
    refreshViews();

    console.error(
      'Erreur toggleFavorite :',
      error
    );

    showToast(
      `Erreur favoris : ${
        error.message || error
      }`,
      'error'
    );
  }
}

window.toggleFavorite = toggleFavorite;

// ─────────────────────────────────────────────
// 10. ÉVÉNEMENTS DES LIEUX
// ─────────────────────────────────────────────

function bindPlaces() {
  [
    'filter-search',
    'filter-type',
    'filter-status'
  ].forEach((id) => {
    bindIfExists(id, 'input', refreshViews);
    bindIfExists(id, 'change', refreshViews);
  });

  bindIfExists(
    'btn-my-locations',
    'click',
    () => {
      favoritesOnly = !favoritesOnly;

      const button =
        getElement('btn-my-locations');

      button?.classList.toggle(
        'btn-primary',
        favoritesOnly
      );

      button?.classList.toggle(
        'btn-secondary',
        !favoritesOnly
      );

      refreshViews();
    }
  );

  bindIfExists(
    'btn-add-place',
    'click',
    () => {
      editingId = null;
      openModal(null);
    }
  );

  bindIfExists(
    'modal-close',
    'click',
    closeModal
  );

  bindIfExists(
    'btn-cancel-place',
    'click',
    closeModal
  );

  bindIfExists(
    'btn-delete-place',
    'click',
    () => {
      if (editingId) {
        deletePlace(editingId);
      }
    }
  );

  bindIfExists(
    'place-modal',
    'click',
    (event) => {
      if (event.target === event.currentTarget) {
        closeModal();
      }
    }
  );

  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    }
  );

  const form = getElement('place-form');

  form?.addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();

      const errorElement =
        getElement('place-form-error');

      errorElement?.classList.add('hidden');

      const name =
        form.elements['place-name']
          ?.value.trim() || '';

      const latValue =
        form.elements['place-lat']?.value;

      const lngValue =
        form.elements['place-lng']?.value;

      const surfaceValue =
        form.elements['place-surface']?.value;

      const rentValue =
        form.elements['place-rent']?.value;

      const formData = {
        name,

        type:
          form.elements['place-type']
            ?.value || 'other',

        description:
          form.elements['place-description']
            ?.value.trim() || '',

        address:
          form.elements['place-address']
            ?.value.trim() || '',

        city:
          form.elements['place-city']
            ?.value.trim() || '',

        postal_code:
          form.elements['place-postal']
            ?.value.trim() || '',

        country:
          form.elements['place-country']
            ?.value.trim() || 'France',

        lat: normalizeNullableNumber(
          latValue
        ),

        lng: normalizeNullableNumber(
          lngValue
        ),

        contact_email:
          form.elements['place-email']
            ?.value.trim() || '',

        phone:
          form.elements['place-phone']
            ?.value.trim() || '',

        website:
          form.elements['place-website']
            ?.value.trim() || '',

        tags:
          form.elements['place-tags']
            ?.value.trim() || '',

        status:
          form.elements['place-status']
            ?.value || 'prospect',

        priority:
          form.elements['place-priority']
            ?.value || 'medium',

        favorite: Boolean(
          form.elements['place-favorite']
            ?.checked
        ),

        surface_m2:
          normalizeNullableNumber(
            surfaceValue
          ),

        rent_monthly:
          normalizeNullableNumber(
            rentValue
          ),

        notes:
          form.elements['place-notes']
            ?.value.trim() || '',

        next_action:
          form.elements['place-next-action']
            ?.value.trim() || '',

        next_date:
          form.elements['place-next-date']
            ?.value || null
      };

      if (!formData.name) {
        if (errorElement) {
          errorElement.textContent =
            'Le nom est obligatoire.';

          errorElement.classList.remove(
            'hidden'
          );
        }

        return;
      }

      if (
        formData.lat !== null &&
        (formData.lat < -90 ||
          formData.lat > 90)
      ) {
        if (errorElement) {
          errorElement.textContent =
            'La latitude doit être comprise entre -90 et 90.';

          errorElement.classList.remove(
            'hidden'
          );
        }

        return;
      }

      if (
        formData.lng !== null &&
        (formData.lng < -180 ||
          formData.lng > 180)
      ) {
        if (errorElement) {
          errorElement.textContent =
            'La longitude doit être comprise entre -180 et 180.';

          errorElement.classList.remove(
            'hidden'
          );
        }

        return;
      }

      await savePlace(formData);
    }
  );
}

// ─────────────────────────────────────────────
// 11. MODALE
// ─────────────────────────────────────────────

function setFormValue(form, name, value) {
  const field = form.elements[name];

  if (!field) return;

  if (field.type === 'checkbox') {
    field.checked = Boolean(value);
  } else {
    field.value = value ?? '';
  }
}

function openModal(place) {
  const modal = getElement('place-modal');
  const form = getElement('place-form');
  const title = getElement('modal-title');

  const deleteButton =
    getElement('btn-delete-place');

  const errorElement =
    getElement('place-form-error');

  if (!modal || !form) return;

  errorElement?.classList.add('hidden');

  if (place) {
    editingId = String(place.id);

    if (title) {
      title.textContent =
        '✏️ Modifier le lieu';
    }

    deleteButton?.classList.remove('hidden');

    setFormValue(
      form,
      'place-name',
      place.name
    );

    setFormValue(
      form,
      'place-type',
      place.type || 'other'
    );

    setFormValue(
      form,
      'place-description',
      place.description
    );

    setFormValue(
      form,
      'place-address',
      place.address
    );

    setFormValue(
      form,
      'place-city',
      place.city
    );

    setFormValue(
      form,
      'place-postal',
      place.postal_code
    );

    setFormValue(
      form,
      'place-country',
      place.country || 'France'
    );

    setFormValue(
      form,
      'place-lat',
      place.lat
    );

    setFormValue(
      form,
      'place-lng',
      place.lng
    );

    setFormValue(
      form,
      'place-email',
      place.contact_email
    );

    setFormValue(
      form,
      'place-phone',
      place.phone
    );

    setFormValue(
      form,
      'place-website',
      place.website
    );

    setFormValue(
      form,
      'place-tags',
      place.tags
    );

    setFormValue(
      form,
      'place-status',
      place.status || 'prospect'
    );

    setFormValue(
      form,
      'place-priority',
      place.priority || 'medium'
    );

    setFormValue(
      form,
      'place-favorite',
      place.favorite
    );

    setFormValue(
      form,
      'place-surface',
      place.surface_m2
    );

    setFormValue(
      form,
      'place-rent',
      place.rent_monthly
    );

    setFormValue(
      form,
      'place-notes',
      place.notes
    );

    setFormValue(
      form,
      'place-next-action',
      place.next_action
    );

    setFormValue(
      form,
      'place-next-date',
      place.next_date
    );
  } else {
    editingId = null;

    if (title) {
      title.textContent =
        '➕ Ajouter un lieu';
    }

    deleteButton?.classList.add('hidden');

    form.reset();

    setFormValue(
      form,
      'place-country',
      'France'
    );

    setFormValue(
      form,
      'place-status',
      'prospect'
    );

    setFormValue(
      form,
      'place-priority',
      'medium'
    );

    setFormValue(
      form,
      'place-type',
      'gallery'
    );
  }

  modal.classList.remove('hidden');

  window.setTimeout(() => {
    form.elements['place-name']?.focus();
  }, 50);
}

function closeModal() {
  getElement('place-modal')
    ?.classList.add('hidden');

  editingId = null;

  getElement('place-form-error')
    ?.classList.add('hidden');
}

window.openEditModal = function openEditModal(id) {
  const place = places.find(
    (item) =>
      String(item.id) === String(id)
  );

  if (!place) {
    showToast(
      'Lieu introuvable.',
      'error'
    );

    return;
  }

  openModal(place);
};
