/* ============================================
   Cultural Places Scout — app.js
   Vanilla JS, Supabase v2, Leaflet CDN
   ============================================ */

'use strict';

// ─────────────────────────────────────────────
// 1. CONFIGURATION SUPABASE
// Important : ne pas ajouter /rest/v1/ à l'URL
// ─────────────────────────────────────────────

const SUPABASE_URL = 'https://hawimjftwmrwljkjsnzu.supabase.co';

const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhhd2ltamZ0d21yd2xqa2pzbnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMjk4MTIsImV4cCI6MjEwMDgwNTgxMn0.Ej-PlxrKOd8cL9m3yQfIh3H9AvvDjY_d2xWGZskCz1s';

// Client initialisé après le chargement du DOM.
let db = null;

// ─────────────────────────────────────────────
// 2. ÉTAT DE L'APPLICATION
// ─────────────────────────────────────────────

let map = null;
let markers = [];
let places = [];
let editingId = null;
let currentView = 'list';
let favoritesOnly = false;

// ─────────────────────────────────────────────
// 3. HELPERS
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
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = '…';
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
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
      value.startsWith('http://') || value.startsWith('https://')
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
// 4. INITIALISATION
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', initializeApplication);

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

  // Un seul client Supabase dans toute l'application.
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

  const authBox = getElement('auth-screen')?.querySelector('.auth-box');

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
// 5. AUTHENTIFICATION
// ─────────────────────────────────────────────

async function restoreSession() {
  showScreen('auth');

  const { data, error } = await db.auth.getSession();

  if (error) {
    showToast(`Erreur de session : ${error.message}`, 'error');
  }

  if (data?.session?.user) {
    await onAuthSuccess(data.session.user);
  }

  db.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      onLogout();
      return;
    }

    if (event === 'SIGNED_IN') {
      await onAuthSuccess(session.user);
    }
  });
}

async function onAuthSuccess(user) {
  const userEmail = getElement('user-email');

  if (userEmail) {
    userEmail.textContent = user.email || '';
  }

  showScreen('app');
  await loadPlaces();
}

function onLogout() {
  places = [];
  editingId = null;

  clearMarkers();

  const tbody = getElement('places-tbody');
  const userEmail = getElement('user-email');

  if (tbody) tbody.innerHTML = '';
  if (userEmail) userEmail.textContent = '';

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

      const isRegister = button.dataset.tab === 'register';
      const submitButton = getElement('auth-submit');
      const confirmGroup = getElement('confirm-group');
      const errorElement = getElement('auth-error');

      if (submitButton) {
        submitButton.textContent = isRegister
          ? 'Créer un compte'
          : 'Connexion';
      }

      if (confirmGroup) {
        confirmGroup.style.display = isRegister ? 'flex' : 'none';
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

    const email = getElement('auth-email')?.value.trim() || '';
    const password = getElement('auth-password')?.value || '';

    const activeTab = document.querySelector('.tab-btn.active');
    const isRegister = activeTab?.dataset.tab === 'register';

    try {
      if (!email || !password) {
        throw new Error('Email et mot de passe obligatoires.');
      }

      if (password.length < 6) {
        throw new Error(
          'Le mot de passe doit contenir au moins 6 caractères.'
        );
      }

      if (isRegister) {
        const confirmation = getElement('auth-confirm')?.value || '';

        if (password !== confirmation) {
          throw new Error('Les mots de passe ne correspondent pas.');
        }

        const { error } = await db.auth.signUp({
          email,
          password
        });

        if (error) throw error;

        showToast(
          'Compte créé. Vérifie éventuellement ton email.',
          'success'
        );

        resetAuthForm();
      } else {
        const { error } = await db.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        showToast('Connexion réussie.', 'success');
      }
    } catch (error) {
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
    const { error } = await db.auth.signOut();

    if (error) {
      showToast(`Erreur : ${error.message}`, 'error');
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
  if (confirmGroup) confirmGroup.style.display = 'none';

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
// 6. CARTE
// ─────────────────────────────────────────────

function initMap() {
  if (map) {
    map.invalidateSize();
    return;
  }

  map = window.L.map('map', {
    zoomControl: true
  }).setView([46.6031, 2.0], 6);

  window.L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }
  ).addTo(map);

  map.on('click', (event) => {
    const lat = event.latlng.lat.toFixed(6);
    const lng = event.latlng.lng.toFixed(6);

    const latInput = getElement('place-lat');
    const lngInput = getElement('place-lng');

    if (latInput) latInput.value = lat;
    if (lngInput) lngInput.value = lng;

    const tooltip = getElement('map-coord-tooltip');

    if (tooltip) {
      tooltip.textContent = `📍 ${lat}, ${lng}`;
      tooltip.classList.remove('hidden');

      window.clearTimeout(window.coordinateTooltipTimer);

      window.coordinateTooltipTimer = window.setTimeout(() => {
        tooltip.classList.add('hidden');
      }, 3000);
    }
  });
}

function createMarkerIcon(type) {
  const colors = {
    gallery: '#a78bfa',
    museum: '#60a5fa',
    theater: '#f87171',
    concert: '#86efac',
    cultural_center: '#fcd34d',
    library: '#93c5fd',
    cinema: '#f9a8d4',
    other: '#9ca3af'
  };

  const color = colors[type] || colors.other;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg"
         width="28"
         height="36"
         viewBox="0 0 28 36">
      <path
        d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22s14-12.667 14-22C28 6.268 21.732 0 14 0z"
        fill="${color}">
      </path>
      <circle cx="14" cy="14" r="6" fill="white" opacity="0.85"></circle>
    </svg>
  `;

  return window.L.divIcon({
    html: svg,
    className: 'custom-marker',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36]
  });
}

function renderMarkers() {
  if (!map) return;

  clearMarkers();

  getFilteredPlaces().forEach((place) => {
    const lat = Number(place.lat);
    const lng = Number(place.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    const marker = window.L
      .marker([lat, lng], {
        icon: createMarkerIcon(place.type)
      })
      .addTo(map);

    const websiteUrl = safeUrl(place.website);

    const popup = `
      <div style="min-width:200px">
        <strong style="font-size:14px">
          ${esc(place.name)}
        </strong>

        <br>

        <span style="color:#8b949e;font-size:12px">
          ${esc(place.city || '')}
          ${place.country ? `, ${esc(place.country)}` : ''}
        </span>

        <br>

        <span class="badge-type ${esc(place.type)}">
          ${esc(TYPE_LABELS[place.type] || place.type || 'Autre')}
        </span>

        <span class="badge-status ${esc(place.status)}">
          ${esc(STATUS_LABELS[place.status] || place.status || 'Prospect')}
        </span>

        ${place.favorite ? '<br>⭐ Favori' : ''}

        ${
          place.address
            ? `<br><small style="color:#8b949e">${esc(place.address)}</small>`
            : ''
        }

        ${
          place.contact_email
            ? `
              <br>
              <small>
                ✉️
                <a href="mailto:${esc(place.contact_email)}"
                   style="color:#58a6ff">
                  ${esc(place.contact_email)}
                </a>
              </small>
            `
            : ''
        }

        ${
          websiteUrl
            ? `
              <br>
              <small>
                🔗
                <a href="${esc(websiteUrl)}"
                   target="_blank"
                   rel="noopener noreferrer"
                   style="color:#58a6ff">
                  Site web
                </a>
              </small>
            `
            : ''
        }

        <br>

        <button
          type="button"
          onclick="openEditModal('${place.id}')"
          style="
            margin-top:6px;
            background:#21262d;
            border:1px solid #30363d;
            color:#c9d1d9;
            padding:4px 10px;
            border-radius:6px;
            cursor:pointer;
            font-size:12px;
          ">
          Éditer
        </button>
      </div>
    `;

    marker.bindPopup(popup);
    markers.push({ id: place.id, marker });
  });
}

function clearMarkers() {
  markers.forEach(({ marker }) => {
    marker.remove();
  });

  markers = [];
}

function fitBounds() {
  if (!map || markers.length === 0) {
    map?.setView([46.6031, 2.0], 6);
    return;
  }

  const positions = markers.map(({ marker }) => marker.getLatLng());

  if (positions.length === 1) {
    map.setView(positions[0], 13);
    return;
  }

  map.fitBounds(positions, {
    padding: [40, 40],
    maxZoom: 12
  });
}

function bindMap() {
  bindIfExists('btn-fit-markers', 'click', fitBounds);

  bindIfExists('filter-view', 'change', (event) => {
    currentView = event.target.value;

    const mapPanel = getElement('view-map');
    const listPanel = getElement('view-list');

    if (currentView === 'map') {
      mapPanel?.classList.remove('hidden');
      listPanel?.classList.add('hidden');

      window.setTimeout(() => {
        initMap();
        renderMarkers();
        map.invalidateSize();

        if (markers.length > 0) {
          fitBounds();
        }
      }, 100);
    } else {
      mapPanel?.classList.add('hidden');
      listPanel?.classList.remove('hidden');
    }
  });

  bindIfExists('btn-geolocate', 'click', () => {
    if (!navigator.geolocation) {
      showToast('Géolocalisation non disponible.', 'error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude.toFixed(6);
        const lng = position.coords.longitude.toFixed(6);

        const latInput = getElement('place-lat');
        const lngInput = getElement('place-lng');

        if (latInput) latInput.value = lat;
        if (lngInput) lngInput.value = lng;

        showToast('Position définie.', 'success');
      },
      () => {
        showToast(
          'Impossible d’obtenir ta position.',
          'error'
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000
      }
    );
  });
}

// ─────────────────────────────────────────────
// 7. CHARGEMENT ET CRUD
// ─────────────────────────────────────────────

async function loadPlaces() {
  setStatus('Chargement…');

  try {
    const { data, error } = await db
      .from('places')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    places = data || [];

    refreshViews();

    setStatus(`${places.length} lieu(x) chargé(s)`);
  } catch (error) {
    console.error(error);

    showToast(
      `Erreur de chargement : ${error.message || error}`,
      'error'
    );

    setStatus('Erreur de chargement');
  }
}

async function savePlace(formData) {
  const saveButton = getElement('btn-save-place');
  const errorElement = getElement('place-form-error');

  setLoading(saveButton, true);

  try {
    const payload = {
      name: formData.name,
      type: formData.type || 'other',
      description: formData.description || null,
      address: formData.address || null,
      city: formData.city || null,
      postal_code: formData.postal_code || null,
      country: formData.country || 'France',
      lat: formData.lat,
      lng: formData.lng,
      contact_email: formData.contact_email || null,
      phone: formData.phone || null,
      website: safeUrl(formData.website),
      tags: formData.tags || null,
      status: formData.status || 'prospect',
      priority: formData.priority || 'medium',
      favorite: Boolean(formData.favorite),
      surface_m2: formData.surface_m2,
      rent_monthly: formData.rent_monthly,
      notes: formData.notes || null,
      next_action: formData.next_action || null,
      next_date: formData.next_date || null,
      updated_at: new Date().toISOString()
    };

    if (editingId) {
      const { data, error } = await db
        .from('places')
        .update(payload)
        .eq('id', editingId)
        .select()
        .single();

      if (error) throw error;

      places = places.map((place) =>
        place.id === editingId ? data : place
      );

      showToast('Lieu mis à jour.', 'success');
    } else {
      const { data, error } = await db
        .from('places')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      places.unshift(data);

      showToast('Lieu ajouté.', 'success');
    }

    refreshViews();
    closeModal();
  } catch (error) {
    console.error(error);

    showToast(
      `Erreur : ${error.message || error}`,
      'error'
    );

    if (errorElement) {
      errorElement.textContent =
        error.message || 'Erreur inconnue';

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
    const { error } = await db
      .from('places')
      .delete()
      .eq('id', id);

    if (error) throw error;

    places = places.filter((place) => place.id !== id);

    refreshViews();
    closeModal();

    showToast('Lieu supprimé.', 'success');
  } catch (error) {
    showToast(
      `Erreur de suppression : ${error.message || error}`,
      'error'
    );
  }
}

// ─────────────────────────────────────────────
// 8. FILTRES ET AFFICHAGE
// ─────────────────────────────────────────────

function getFilteredPlaces() {
  const search =
    getElement('filter-search')?.value.toLowerCase().trim() || '';

  const type = getElement('filter-type')?.value || '';
  const status = getElement('filter-status')?.value || '';

  return places.filter((place) => {
    if (favoritesOnly && !place.favorite) return false;
    if (type && place.type !== type) return false;
    if (status && place.status !== status) return false;

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

      if (!content.includes(search)) return false;
    }

    return true;
  });
}

function renderPlaces() {
  const filteredPlaces = getFilteredPlaces();

  const countElement = getElement('place-count');
  const tbody = getElement('places-tbody');
  const noPlaces = getElement('no-places');

  if (countElement) {
    countElement.textContent =
      `${filteredPlaces.length} / ${places.length} lieu(x)`;
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
      const websiteUrl = safeUrl(place.website);

      const favoriteButton = `
        <button
          type="button"
          class="btn-icon ${place.favorite ? 'active-star' : ''}"
          onclick="event.stopPropagation(); toggleFavorite('${place.id}')"
          title="Favori">
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
            title="Ouvrir le site">
            🔗
          </a>
        `
        : '';

      return `
        <tr onclick="openEditModal('${place.id}')">
          <td class="td-name">
            ${esc(place.name)}
          </td>

          <td>
            <span class="badge-type ${esc(place.type)}">
              ${esc(TYPE_LABELS[place.type] || place.type || 'Autre')}
            </span>
          </td>

          <td class="td-type">
            ${esc(place.city || '')}
          </td>

          <td class="td-status">
            <span class="badge-status ${esc(place.status)}">
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
              onclick="event.stopPropagation(); openEditModal('${place.id}')">
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
  const place = places.find((item) => item.id === id);

  if (!place) return;

  const favorite = !place.favorite;

  try {
    const { error } = await db
      .from('places')
      .update({
        favorite,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;

    place.favorite = favorite;

    refreshViews();
  } catch (error) {
    showToast(
      `Erreur favoris : ${error.message || error}`,
      'error'
    );
  }
}

window.toggleFavorite = toggleFavorite;

// ─────────────────────────────────────────────
// 9. ÉVÉNEMENTS DES LIEUX
// ─────────────────────────────────────────────

function bindPlaces() {
  ['filter-search', 'filter-type', 'filter-status'].forEach((id) => {
    bindIfExists(id, 'input', refreshViews);
    bindIfExists(id, 'change', refreshViews);
  });

  bindIfExists('btn-my-locations', 'click', () => {
    favoritesOnly = !favoritesOnly;

    const button = getElement('btn-my-locations');

    button?.classList.toggle('btn-primary', favoritesOnly);
    button?.classList.toggle('btn-secondary', !favoritesOnly);

    refreshViews();
  });

  bindIfExists('btn-add-place', 'click', () => {
    editingId = null;
    openModal(null);
  });

  bindIfExists('modal-close', 'click', closeModal);
  bindIfExists('btn-cancel-place', 'click', closeModal);

  bindIfExists('btn-delete-place', 'click', () => {
    deletePlace(editingId);
  });

  bindIfExists('place-modal', 'click', (event) => {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeModal();
    }
  });

  const form = getElement('place-form');

  form?.addEventListener('submit', (event) => {
    event.preventDefault();

    getElement('place-form-error')?.classList.add('hidden');

    const latValue = form.elements['place-lat']?.value;
    const lngValue = form.elements['place-lng']?.value;
    const surfaceValue = form.elements['place-surface']?.value;
    const rentValue = form.elements['place-rent']?.value;

    const formData = {
      name: form.elements['place-name'].value.trim(),
      type: form.elements['place-type'].value,
      description:
        form.elements['place-description'].value.trim(),
      address: form.elements['place-address'].value.trim(),
      city: form.elements['place-city'].value.trim(),
      postal_code: form.elements['place-postal'].value.trim(),
      country: form.elements['place-country'].value.trim(),
      lat: latValue ? Number(latValue) : null,
      lng: lngValue ? Number(lngValue) : null,
      contact_email:
        form.elements['place-email'].value.trim(),
      phone: form.elements['place-phone'].value.trim(),
      website: form.elements['place-website'].value.trim(),
      tags: form.elements['place-tags'].value.trim(),
      status: form.elements['place-status'].value,
      priority: form.elements['place-priority'].value,
      favorite: form.elements['place-favorite'].checked,
      surface_m2: surfaceValue ? Number(surfaceValue) : null,
      rent_monthly: rentValue ? Number(rentValue) : null,
      notes: form.elements['place-notes'].value.trim(),
      next_action:
        form.elements['place-next-action'].value.trim(),
      next_date: form.elements['place-next-date'].value || null
    };

    if (!formData.name) {
      const errorElement = getElement('place-form-error');

      if (errorElement) {
        errorElement.textContent = 'Le nom est obligatoire.';
        errorElement.classList.remove('hidden');
      }

      return;
    }

    savePlace(formData);
  });
}

// ─────────────────────────────────────────────
// 10. MODALE
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
  const deleteButton = getElement('btn-delete-place');
  const errorElement = getElement('place-form-error');

  if (!modal || !form) return;

  errorElement?.classList.add('hidden');

  if (place) {
    editingId = place.id;

    if (title) title.textContent = '✏️ Modifier le lieu';

    deleteButton?.classList.remove('hidden');

    setFormValue(form, 'place-name', place.name);
    setFormValue(form, 'place-type', place.type || 'other');
    setFormValue(form, 'place-description', place.description);
    setFormValue(form, 'place-address', place.address);
    setFormValue(form, 'place-city', place.city);
    setFormValue(form, 'place-postal', place.postal_code);
    setFormValue(form, 'place-country', place.country || 'France');
    setFormValue(form, 'place-lat', place.lat);
    setFormValue(form, 'place-lng', place.lng);
    setFormValue(form, 'place-email', place.contact_email);
    setFormValue(form, 'place-phone', place.phone);
    setFormValue(form, 'place-website', place.website);
    setFormValue(form, 'place-tags', place.tags);
    setFormValue(form, 'place-status', place.status || 'prospect');
    setFormValue(form, 'place-priority', place.priority || 'medium');
    setFormValue(form, 'place-favorite', place.favorite);
    setFormValue(form, 'place-surface', place.surface_m2);
    setFormValue(form, 'place-rent', place.rent_monthly);
    setFormValue(form, 'place-notes', place.notes);
    setFormValue(form, 'place-next-action', place.next_action);
    setFormValue(form, 'place-next-date', place.next_date);
  } else {
    editingId = null;

    if (title) title.textContent = '➕ Ajouter un lieu';

    deleteButton?.classList.add('hidden');

    form.reset();

    setFormValue(form, 'place-country', 'France');
    setFormValue(form, 'place-status', 'prospect');
    setFormValue(form, 'place-priority', 'medium');
    setFormValue(form, 'place-type', 'gallery');
  }

  modal.classList.remove('hidden');

  window.setTimeout(() => {
    form.elements['place-name']?.focus();
  }, 50);
}

function closeModal() {
  getElement('place-modal')?.classList.add('hidden');

  editingId = null;

  getElement('place-form-error')?.classList.add('hidden');
}

window.openEditModal = function openEditModal(id) {
  const place = places.find((item) => item.id === id);

  if (!place) {
    showToast('Lieu introuvable.', 'error');
    return;
  }

  openModal(place);
};
