// Données figées de la scène « Supervision temps réel » (étape tour).
// Aucun appel réseau : le flux SCADA est simulé côté app à partir de ces bases
// (random-walk avec retour à la moyenne dans le layer). Le réseau et les postes
// proviennent de sample-pois.ts ; ici on ajoute charges/capacités + routes flotte.

// Seuils de charge (fraction de la capacité du poste).
export const RT_WARN = 0.7
export const RT_CRIT = 0.9

export type PosteCfg = {
  // Capacité du poste en MVA (le poste source domine la charge réseau en MW).
  capMva: number
  // Charge nominale autour de laquelle oscille la simulation.
  base: number
  // Amplitude du bruit par tick.
  jitter: number
}

// Indexé par POIProps.id (cf. SAMPLE_POIS). Baseline volontairement CALME : aucun
// poste ne franchit le seuil critique de lui-même, pour que la surcharge scriptée
// du poste source (id 1) soit la SEULE anomalie rouge du scénario (réseau « tout
// vert » à l'entrée). Bois Renault (id 5) et La Charmoie (id 10) restent en
// « surveillé » (ambre) pour le réalisme — jamais rouge.
export const RT_POSTE_CONFIG: Record<number, PosteCfg> = {
  1: { capMva: 11, base: 0.58, jitter: 0.05 }, // P-4521 poste source Salbris
  2: { capMva: 0.12, base: 0.55, jitter: 0.07 },
  3: { capMva: 0.16, base: 0.5, jitter: 0.07 },
  4: { capMva: 0.42, base: 0.6, jitter: 0.06 },
  5: { capMva: 0.06, base: 0.8, jitter: 0.04 }, // P-1102 Bois Renault → surveillé (ambre)
  6: { capMva: 0.1, base: 0.52, jitter: 0.07 },
  7: { capMva: 0.26, base: 0.58, jitter: 0.05 },
  8: { capMva: 0.1, base: 0.6, jitter: 0.07 },
  9: { capMva: 0.05, base: 0.48, jitter: 0.08 },
  10: { capMva: 0.26, base: 0.72, jitter: 0.06 }, // P-1990 La Charmoie → surveillé
}

// Capacité cumulée du réseau (plafond stable pour l'axe Y du graphe streaming).
export const RT_TOTAL_CAP_MVA = Object.values(RT_POSTE_CONFIG).reduce((a, c) => a + c.capMva, 0)

export type FleetRoute = {
  label: string
  // Tracé d'aller depuis le poste source, suivant EXACTEMENT la géométrie de
  // SAMPLE_HTA_LINES (points de courbe inclus) pour que les véhicules roulent sur
  // les lignes affichées. Le layer construit l'aller-retour pour boucler.
  coords: [number, number][]
  // Tours par cycle (varie la vitesse des équipes).
  speed: number
  // Décalage de départ [0..1] pour désynchroniser les véhicules.
  phase: number
}

// Routes = concaténation de segments réels de SAMPLE_HTA_LINES depuis le poste
// source P-4521 [2.04, 47.428] (jonctions dédoublonnées). Les équipes patrouillent
// les départs HTA le long du réseau visible.
export const RT_ROUTES: FleetRoute[] = [
  {
    // Source → Chemin Vert → Les Granges → Quatre-Chemins → Plaine des Bouvreuils
    // → Bois Renault (le poste en alerte).
    label: 'Équipe Ouest',
    coords: [
      [2.04, 47.428],
      [1.99, 47.41],
      [1.94, 47.395],
      [1.85, 47.405],
      [1.76, 47.42],
      [1.755, 47.395],
      [1.745, 47.365],
      [1.67, 47.405],
      [1.6, 47.44],
      [1.62, 47.42],
      [1.64, 47.395],
    ],
    speed: 1,
    phase: 0,
  },
  {
    // Source → Étang du Coq → Moulin Neuf → La Borderie (boucle nord).
    label: 'Équipe Nord',
    coords: [
      [2.04, 47.428],
      [2.01, 47.47],
      [1.985, 47.5],
      [1.91, 47.512],
      [1.835, 47.52],
      [1.86, 47.5],
      [1.87, 47.48],
    ],
    speed: 0.82,
    phase: 0.4,
  },
  {
    // Source → Chemin Vert → Les Granges → Quatre-Chemins → La Charmoie (spur est).
    label: 'Équipe Est',
    coords: [
      [2.04, 47.428],
      [1.99, 47.41],
      [1.94, 47.395],
      [1.85, 47.405],
      [1.76, 47.42],
      [1.755, 47.395],
      [1.745, 47.365],
      [1.77, 47.395],
      [1.795, 47.43],
    ],
    speed: 1.15,
    phase: 0.6,
  },
]
