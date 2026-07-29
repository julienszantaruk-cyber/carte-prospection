# Prospection de lieux culturels

Application de prospection : ateliers d'artistes, tiers-lieux, châteaux, galeries.

## Stack

- HTML / CSS / JS vanilla, ES modules natifs — **aucun build**
- Supabase (auth + Postgres)
- Leaflet + tuiles CARTO dark

## Arborescence
index.html          structure + tous les ids
vercel.json         config d'hébergement
css/base.css        variables, reset, typographie
css/layout.css      grille, panneaux, vues
css/components.css  boutons, champs, cartes, modales
js/config.js        clés Supabase + énumérations
js/dom.js           EL{}, on(), assertDom(), esc()
js/state.js         état global
js/sanitize.js      validation avant écriture
js/score.js         calcul du score pondéré
js/auth.js          connexion / déconnexion
js/data.js          lectures / écritures Supabase
js/filters.js       filtres, tri, recherche
js/map.js           carte Leaflet
js/list.js          panneau latéral
js/table.js         vue tableau
js/dashboard.js     KPIs
js/sheet.js         fiche lieu
js/settings.js      types, critères, colonnes
js/io.js            import / export
js/boot.js          point d'entrée

## Comptes utilisateurs

Les inscriptions sont **fermées**. Créer les comptes depuis
Supabase → Authentication → Users → Add user (cocher *Auto Confirm User*).

## Modifier l'app

Éditer le fichier sur GitHub (crayon ✏️) → Commit.
Vercel redéploie automatiquement en ~20 s.

## Personnalisation sans code

Depuis l'interface, bouton ⚙️ :
- types de lieux (label, emoji, couleur, ordre)
- critères de notation (label, poids, ordre)
- colonnes visibles du tableau

## Raccourcis clavier

| Touche | Action |
|---|---|
| `N` | nouveau lieu |
| `/` | recherche |
| `Échap` | fermer |
