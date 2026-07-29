/* ═══════════════════════════════════════════════════════
   0 · CONFIG — le seul fichier à éditer pour reconfigurer
   ═══════════════════════════════════════════════════════ */

export const SUPA_URL = 'https://hawimjftwmrwljkjsnzu.supabase.co';
export const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhhd2ltamZ0d21yd2xqa2pzbnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMjk4MTIsImV4cCI6MjEwMDgwNTgxMn0.Ej-PlxrKOd8cL9m3yQfIh3H9AvvDjY_d2xWGZskCz1s';

/* ─── Carte ─── */
export const MAP = {
  center : [46.60, 2.30],   // centre de la France
  zoom   : 6,
  zoomOne: 15,              // zoom au clic sur un lieu
  tiles  : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  attrib : '&copy; OpenStreetMap &copy; CARTO',
  maxZoom: 19
};

/* ─── Listes fermées ─── */
export const STATUSES = [
  { v:'a_contacter', l:'À contacter',  badge:'badge-dim'    },
  { v:'contacte',    l:'Contacté',     badge:'badge-acc'    },
  { v:'en_cours',    l:'En cours',     badge:'badge-warn'   },
  { v:'partenaire',  l:'Partenaire',   badge:'badge-ok'     },
  { v:'refus',       l:'Refus',        badge:'badge-danger' },
  { v:'inactif',     l:'Inactif',      badge:'badge-dim'    }
];

export const RELATIONS = [
  { v:'aucune',   l:'Aucune'   },
  { v:'froide',   l:'Froide'   },
  { v:'tiede',    l:'Tiède'    },
  { v:'chaude',   l:'Chaude'   },
  { v:'etablie',  l:'Établie'  }
];

export const PRIORITIES = [
  { v:1, l:'1 · Basse'   },
  { v:2, l:'2 · Moyenne' },
  { v:3, l:'3 · Haute'   },
  { v:4, l:'4 · Urgente' }
];

/* ─── Colonnes du tableau ─── */
export const COLS = [
  { k:'name',       l:'Nom',        def:true  },
  { k:'type',       l:'Type',       def:true  },
  { k:'city',       l:'Ville',      def:true  },
  { k:'status',     l:'Statut',     def:true  },
  { k:'score',      l:'Score',      def:true  },
  { k:'priority',   l:'Priorité',   def:true  },
  { k:'relation',   l:'Relation',   def:false },
  { k:'capacity',   l:'Capacité',   def:false },
  { k:'contact',    l:'Contact',    def:false },
  { k:'email',      l:'Email',      def:false },
  { k:'phone',      l:'Téléphone',  def:false },
  { k:'website',    l:'Site',       def:false },
  { k:'address',    l:'Adresse',    def:false },
  { k:'postcode',   l:'CP',         def:false },
  { k:'region',     l:'Région',     def:false },
  { k:'tags',       l:'Tags',       def:false },
  { k:'next_step',  l:'Prochaine étape', def:false },
  { k:'next_date',  l:'Date relance',    def:false },
  { k:'updated_at', l:'Modifié le', def:false }
];

/* ─── Filtres enregistrés ─── */
export const PRESETS = [
  { id:'all',      l:'Tous'         },
  { id:'fav',      l:'★ Favoris'    },
  { id:'todo',     l:'À contacter'  },
  { id:'hot',      l:'Chauds'       },
  { id:'top',      l:'Score ≥ 70'   },
  { id:'late',     l:'Relance due'  }
];

/* ─── Divers ─── */
export const SORTS = [
  { v:'score_desc', l:'Score ↓'      },
  { v:'score_asc',  l:'Score ↑'      },
  { v:'name_asc',   l:'Nom A→Z'      },
  { v:'name_desc',  l:'Nom Z→A'      },
  { v:'recent',     l:'Récents'      },
  { v:'prio_desc',  l:'Priorité ↓'   }
];

export const TOAST_MS  = 2800;
export const STARS_MAX = 5;
export const LS_PREFIX = 'prosp:';
