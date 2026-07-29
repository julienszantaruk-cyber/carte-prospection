
/* ═══════════════════════════════════════════════════════
   Listes métier — fiche lieu
   Indicatives : `sanitize.place()` les traite en texte libre,
   donc modifier une valeur ici n'invalide aucune donnée existante.
   ═══════════════════════════════════════════════════════ */

export const LEGAL_FORMS = [
  { v:'association_1901',   l:'Association loi 1901'        },
  { v:'association_alsace', l:'Association (Alsace-Moselle)' },
  { v:'fondation',          l:'Fondation'                    },
  { v:'fonds_dotation',     l:'Fonds de dotation'            },
  { v:'scic',               l:'SCIC'                         },
  { v:'scop',               l:'SCOP'                         },
  { v:'sas',                l:'SAS / SASU'                   },
  { v:'sarl',               l:'SARL / EURL'                  },
  { v:'sci',                l:'SCI'                          },
  { v:'auto_entrepreneur',  l:'Micro-entreprise'             },
  { v:'epic',               l:'EPIC / EPA'                   },
  { v:'collectivite',       l:'Collectivité territoriale'    },
  { v:'etablissement_public', l:'Établissement public'       },
  { v:'gie',                l:'GIE'                          },
  { v:'collectif_informel', l:'Collectif informel'           },
  { v:'particulier',        l:'Particulier'                  },
  { v:'autre',              l:'Autre'                        }
];

export const GOVERNANCES = [
  { v:'ca_bureau',        l:'CA + bureau'              },
  { v:'college_solidaire',l:'Collège solidaire'        },
  { v:'direction_unique', l:'Direction unique'          },
  { v:'coop_1p1v',        l:'Coopérative (1 pers. = 1 voix)' },
  { v:'assemblee',        l:'Assemblée générale'       },
  { v:'municipale',       l:'Gouvernance municipale'   },
  { v:'privee',           l:'Privée / actionnaires'    },
  { v:'informelle',       l:'Informelle'               },
  { v:'autre',            l:'Autre'                    }
];

export const BUSINESS_MODELS = [
  { v:'subventionne',   l:'Majoritairement subventionné' },
  { v:'mixte',          l:'Mixte (public + privé)'       },
  { v:'autofinance',    l:'Autofinancé'                  },
  { v:'commercial',     l:'Commercial (bar, boutique…)'  },
  { v:'mecenat',        l:'Mécénat / philanthropie'      },
  { v:'benevole',       l:'Bénévole'                     },
  { v:'locatif',        l:'Revenus locatifs'             },
  { v:'autre',          l:'Autre'                        }
];

export const TENURES = [
  { v:'proprietaire',          l:'Propriétaire'                 },
  { v:'bail_commercial',       l:'Bail commercial'              },
  { v:'bail_precaire',         l:'Bail précaire / dérogatoire'  },
  { v:'bail_emphyteotique',    l:'Bail emphytéotique'           },
  { v:'bail_habitation',       l:'Bail d\'habitation'           },
  { v:'convention',            l:'Convention d\'occupation'     },
  { v:'aot',                   l:'AOT (domaine public)'         },
  { v:'pret',                  l:'Prêt à usage / commodat'      },
  { v:'occupation_temporaire', l:'Occupation temporaire'        },
  { v:'sans_titre',            l:'Occupation sans titre'        },
  { v:'autre',                 l:'Autre'                        }
];

/* ─── Suggestions pour les champs multi-valeurs ───
   Saisie libre assistée (datalist) : aucune contrainte. */

export const REVENUE_SUGGEST = [
  'Subvention État', 'Subvention région', 'Subvention département',
  'Subvention commune', 'Subvention Europe', 'Mécénat privé',
  'Billetterie', 'Bar / restauration', 'Location d\'espaces',
  'Ateliers / formations', 'Boutique', 'Résidences payantes',
  'Adhésions', 'Crowdfunding', 'Prestations de services'
];

export const ACTIVITY_SUGGEST = [
  'Expositions', 'Résidences d\'artistes', 'Ateliers d\'artistes',
  'Concerts', 'Spectacle vivant', 'Cinéma', 'Conférences',
  'Formations', 'Coworking', 'Fablab', 'Restauration',
  'Librairie', 'Éducation artistique', 'Festival',
  'Radio', 'Édition', 'Sérigraphie', 'Céramique'
];

export const FEATURE_SUGGEST = [
  'Quai de déchargement', 'Monte-charge', 'Hauteur > 4 m',
  'Lumière naturelle', 'Occultation totale', 'Sol béton',
  'Chauffage', 'Climatisation', 'Accès PMR', 'Parking',
  'Cuisine', 'Douches', 'Stockage', 'Cour extérieure',
  'Jardin', 'Alarme', 'Wifi', 'Triphasé',
  'Point d\'eau', 'Sanitaires publics', 'Scène', 'Gradins'
];
