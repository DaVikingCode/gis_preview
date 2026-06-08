import type { TableUser } from '@/data/sample-table'

// Statuts = colonnes du Kanban (gauche → droite).
export type TaskStatus = 'a_faire' | 'en_cours' | 'en_revue' | 'termine'

export type TaskPriority = 'basse' | 'moyenne' | 'haute'

export type Task = {
  id: string
  title: string
  owner: TableUser
  status: TaskStatus
  priority: TaskPriority
  // Planning (semaine Lun–Ven) : jour de départ (0 = lundi) et durée en jours.
  day: number // 0–4
  span: number // 1–5
}

// Colonnes du tableau, dans l'ordre d'affichage.
export const KANBAN_COLUMNS: { id: TaskStatus; label: string }[] = [
  { id: 'a_faire', label: 'À faire' },
  { id: 'en_cours', label: 'En cours' },
  { id: 'en_revue', label: 'En revue' },
  { id: 'termine', label: 'Terminé' },
]

export const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven']

// Tâches fil rouge de la démo : reprennent les chapitres de la visite (cadastre,
// LiDAR Auxonne, réseau HTA, import, bâtiments 3D, isochrones…) — mêmes équipiers
// que la vue tabulaire pour la cohérence.
export const SAMPLE_TASKS: Task[] = [
  {
    id: 'TASK-128',
    title: 'Numérisation cadastre — Lyon 7e',
    owner: { name: 'Camille Roux', role: 'Géomaticienne', initials: 'CR', hue: 270 },
    status: 'a_faire',
    priority: 'haute',
    day: 0,
    span: 2,
  },
  {
    id: 'TASK-131',
    title: 'Import couche zones protégées',
    owner: { name: 'Inès Lefèvre', role: 'Analyste SIG', initials: 'IL', hue: 205 },
    status: 'a_faire',
    priority: 'moyenne',
    day: 2,
    span: 2,
  },
  {
    id: 'TASK-134',
    title: 'Calcul isochrones — tournées Centre',
    owner: { name: 'Adrien Faure', role: 'Aménagement', initials: 'AF', hue: 230 },
    status: 'en_cours',
    priority: 'moyenne',
    day: 1,
    span: 3,
  },
  {
    id: 'TASK-136',
    title: 'Relevé LiDAR — Auxonne',
    owner: { name: 'Yanis Caron', role: 'Topographe', initials: 'YC', hue: 188 },
    status: 'en_cours',
    priority: 'haute',
    day: 0,
    span: 4,
  },
  {
    id: 'TASK-139',
    title: 'Contrôle réseau HTA — poste P-4521',
    owner: { name: 'Théo Garnier', role: 'Technicien terrain', initials: 'TG', hue: 95 },
    status: 'en_revue',
    priority: 'haute',
    day: 3,
    span: 2,
  },
  {
    id: 'TASK-142',
    title: 'Modélisation bâtiments 3D — La Défense',
    owner: { name: 'Sofia Marchand', role: 'Urbaniste', initials: 'SM', hue: 8 },
    status: 'en_revue',
    priority: 'basse',
    day: 2,
    span: 1,
  },
  {
    id: 'TASK-145',
    title: 'Drapage terrain — sentier Chamonix',
    owner: { name: 'Léa Fontaine', role: 'Écologue', initials: 'LF', hue: 140 },
    status: 'termine',
    priority: 'moyenne',
    day: 0,
    span: 2,
  },
  {
    id: 'TASK-147',
    title: 'Export SHP/KML vers QGIS',
    owner: { name: 'Nadia Bouchard', role: 'Chef de projet', initials: 'NB', hue: 45 },
    status: 'termine',
    priority: 'basse',
    day: 4,
    span: 1,
  },
]

// Carte déplacée par le faux curseur pendant la démo : « À faire » → « En cours ».
export const KANBAN_DEMO_CARD_ID = 'TASK-128'
export const KANBAN_DEMO_TARGET: TaskStatus = 'en_cours'
// Édition scriptée sur le planning : on étire la durée de la tâche démo (TASK-128,
// day 0) de 2j à 3j (Lun→Mer) en glissant le bord droit de sa barre.
export const KANBAN_DEMO_EXTEND_TO = 3
