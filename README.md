# Cultural Places Scout

Application web de prospection de lieux culturels : carte, filtres, CRUD, authentification email/mot de passe.

- Vanilla HTML/CSS/JS — **aucun build requis**
- Carte Leaflet (CDN) — centrée France, navigable mondialement
- Backend Supabase — auth email/mdp, PostgreSQL, RLS
- Interface responsive sombre
- Déploiement **Vercel statique** immédiat

## Dépendances CDN (incluses, aucun install)

- Leaflet: `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css` + `.js`
- Supabase JS v2: déjà chargé dans `index.html` via CDN JSdelivr

> Le script `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2">` est déjà inclus
> dans `index.html`. Aucune installation requise.

---

## 1 · Setup Supabase

### 1.1 Créer un projet

1. Allez sur [supabase.com](https://supabase.com) → **New Project**
2. Choisissez une région proche de vos utilisateurs
3. Définissez un **Database Password** (fort, SAVE IT)
4. Attendez le déploiement (~2 min)

### 1.2 Exécuter le SQL

1. Dans le dashboard Supabase → **SQL Editor** → **New Query**
2. Collez le contenu de `supabase.sql` et exécutez
3. Vérifiez : la table `places` apparaît dans **Table Editor**

> Le SQL est **idempotent** : vous pouvez le réexécuter sans risque.

### 1.3 Configurer l'authentification

1. **Dashboard → Authentication → Providers**
2. Vérifiez que **Email** est activé (par défaut)
3. Optionnel : activez **Confirm email** si vous voulez valider les inscriptions par email (cochez "Secure email link" dans les settings d'email)

### 1.4 Créer un premier utilisateur

1. **Dashboard → Authentication → Users**
2. Cliquez **Add user** → entrez email + mot de passe
3. Ou : inscrivez-vous depuis l'application (onglet "Inscription")

### 1.5 Récupérer les credentials

1. **Dashboard → Settings → API**
2. Notez :
   - **Project URL** → `SUPABASE_URL`
   - **anon/public** key → `SUPABASE_ANON_KEY`

> ⚠️ **Ne JAMAIS utiliser la `service_role` key côté client.** Elle donne accès admin à votre base. Utilisez-la uniquement dans des fonctions serveur (Edge Functions, etc.)

---

## 2 · Configuration de l'application

### 2.1 Dans `app.js`

Ouvrez `app.js` et remplacez les valeurs de `CONFIG` :

```js
const CONFIG = {
  SUPABASE_URL:    'https://votre-projet.supabase.co',  // ← votre Project URL
  SUPABASE_ANON_KEY: 'eyJhbGci...',                      // ← votre anon key
};
```

### 2.2 Vérifications importantes

- Assurez-vous que **Row Level Security** est activé sur la table `places` (le SQL le fait automatiquement)
- Vérifiez dans **Authentication → Users** que vos utilisateurs ont le rôle `authenticated`
- Si l'authentification échoue : vérifiez dans **Authentication → Settings** que les URLs autorisées incluent votre domaine Vercel (ex: `https://votre-app.vercel.app`)

---

## 3 · Déploiement Vercel

### Option A : Import Git (recommandé)

1. Poussez les 5 fichiers sur un repo GitHub :
   ```
   index.html
   style.css
   app.js
   supabase.sql  (non nécessaire pour Vercel, mais gardez-le dans le repo)
   README.md
   ```
2. Allez sur [vercel.com](https://vercel.com) → **New Project**
3. Importez le repo GitHub
4. **Build & Development Settings** : laissez vide (pas de framework détecté)
5. **Environment Variables** : aucune requise (clé dans `app.js`)
6. Deploy → prêt en ~30s

### Option B : Vercel CLI

```bash
npm i -g vercel
vercel login
vercel
```

Répondez aux questions :
- App name : `cultural-places-scout` (ou libre)
- Directory : `.`
- Override settings : **No**

---

## 4 · Tester rapidement

1. Ouvrez l'application déployée
2. Si un bandeau "⚠️ Supabase non configuré" apparaît → vérifiez `CONFIG` dans `app.js`
3. Allez dans l'onglet **Inscription** → créez un compte
4. Ajoutez un lieu via **+ Ajouter**
5. Ajoutez 2-3 lieux, basculez en **vue carte** pour vérifier les marqueurs
6. Testez **supprimer** et **éditer**
7. Déconnectez-vous → reconnectez-vous → les lieux persistent

---

## 5 · Structure des fichiers

```
/
├── index.html        # Structure HTML (modals, tableau, carte)
├── style.css         # Thème sombre responsive
├── app.js            # CONFIG + toute la logique JS
├── supabase.sql      # Schéma PostgreSQL (à exécuter côté Supabase)
└── README.md         # Ce fichier
```

---

## 6 · Champs disponibles dans `places`

| Champ | Type | Description |
|---|---|---|
| `id` | UUID | Identifiant unique (auto) |
| `owner_id` | UUID | Propriétaire (lié à `auth.users`) |
| `name` | VARCHAR | Nom du lieu |
| `type` | VARCHAR | gallery, museum, theater, concert, cultural_center, library, cinema, other |
| `description` | TEXT | Description libre |
| `address` | VARCHAR | Adresse |
| `city` | VARCHAR | Ville |
| `postal_code` | VARCHAR | Code postal |
| `country` | VARCHAR | Pays |
| `lat` / `lng` | NUMERIC | Coordonnées (clic carte ou géoloc) |
| `contact_email` | VARCHAR | Email de contact |
| `phone` | VARCHAR | Téléphone |
| `website` | VARCHAR | URL (validée) |
| `tags` | VARCHAR | Tags séparés par virgule |
| `status` | VARCHAR | prospect, contacted, negotiating, contracted, archived |
| `priority` | VARCHAR | low, medium, high |
| `favorite` | BOOLEAN | Favori |
| `surface_m2` | NUMERIC | Surface en m² |
| `rent_monthly` | NUMERIC | Loyer mensuel (€) |
| `notes` | TEXT | Notes |
| `next_action` | VARCHAR | Prochaine action |
| `next_date` | DATE | Date prévue |
| `created_at` | TIMESTAMPTZ | Date de création |
| `updated_at` | TIMESTAMPTZ | Date de mise à jour (auto) |

---

## 7 · Sécurité

- **RLS** : chaque utilisateur ne voit/modifie que ses propres lieux (`WHERE auth.uid() = owner_id`)
- **Pas de `service_role`** dans le frontend
- **textContent** utilisé pour tout affichage (pas `innerHTML` sur les entrées utilisateur) → anti-XSS
- **URL validée** (`new URL()` + `startsWith('http')`) avant insertion dans `href`
- Validation des coordonnées : contraintes `CHECK` SQL (`-90 ≤ lat ≤ 90`, `-180 ≤ lng ≤ 180`)
- Requêtes désactivées pendant les opérations pour éviter les doubles soumissions

---

## 8 · Variables d'environnement (optionnel)

Si vous préférez externaliser les clés :

```js
const CONFIG = {
  SUPABASE_URL:      window.env?.SUPABASE_URL  || 'YOUR_SUPABASE_URL',
  SUPABASE_ANON_KEY: window.env?.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY',
};
```

Sous Vercel : **Settings → Environment Variables** → ajouter `SUPABASE_URL` et `SUPABASE_ANON_KEY`.

---

## 9 · Support & dépannage

| Problème | Solution |
|---|---|
| Bandeau "Supabase non configuré" | Vérifiez `SUPABASE_URL` dans `app.js` (doit démarrer par `https://`) |
| Erreur "Not authenticated" | Vérifiez que vous êtes connecté ; vérifiez les policies RLS dans le SQL |
| Marques non visibles sur la carte | Ajoutez des lieux avec latitude/longitude ; basculez en vue carte |
| Erreur CORS | Assurez-vous que votre Supabase Project n'a pas de restrictions IP excessives |
| Session non restaurée | `onAuthStateChange` est configuré dans `restoreSession()` ; vérifiez la console |