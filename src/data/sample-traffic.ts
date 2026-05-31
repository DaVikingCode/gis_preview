import type { FeatureCollection, LineString } from 'geojson'

// Foyer de congestion : [centre, demi-largeur, intensité], en fraction 0..1 de la
// longueur du corridor (densité synthétique → couleur vert → orange → rouge).
export type Hotspot = [number, number, number]

// Corridors de circulation fictifs traversant le quartier d'affaires de La Défense,
// utilisés à l'étape « Bâtiments 3D appliqués » pour matérialiser la densité du
// trafic (lignes animées). Chaque feature porte ses propres foyers de congestion
// dans properties.hotspots, donc les zones orange/rouge tombent à des endroits
// différents d'une ligne à l'autre. Coordonnées figées, aucun appel réseau.
export const TRAFFIC_CORRIDORS: FeatureCollection<LineString, { hotspots: Hotspot[] }> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        hotspots: [
          [0.28, 0.07, 0.7], // ralentissement (orange)
          [0.55, 0.06, 1.0], // bouchon (rouge)
          [0.82, 0.05, 0.55], // léger ralentissement
        ],
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [2.236808, 48.8918471],
          [2.2411117, 48.8905688],
          [2.2427449, 48.8901938],
          [2.2444956, 48.8894703],
          [2.2458328, 48.8891162],
          [2.2467043, 48.8889451],
          [2.2476422, 48.8886639],
          [2.2488148, 48.8883086],
          [2.2503559, 48.8878299],
          [2.2517729, 48.8874305],
          [2.2526058, 48.8871806],
          [2.2528288, 48.8870761],
          [2.2561474, 48.8860068],
          [2.2568239, 48.8857861],
          [2.2589217, 48.8851344],
          [2.2603541, 48.8847072],
          [2.2615709, 48.8843323],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        hotspots: [
          [0.12, 0.05, 1.0], // bouchon (rouge) en amont
          [0.5, 0.07, 0.45], // léger ralentissement au milieu
          [0.85, 0.05, 0.9], // bouchon (rouge) en aval
        ],
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [2.226364684140691, 48.89572033239929],
          [2.235137237336545, 48.892900768563976],
          [2.2388173745349604, 48.891938760953906],
          [2.241448241687465, 48.8910529587514],
          [2.2420998571117536, 48.89053587205072],
          [2.2431589066597724, 48.8903591680326],
          [2.2490101061868017, 48.88851103973252],
          [2.250954971211314, 48.88790138929048],
          [2.257318873316393, 48.885842902852204],
          [2.2625801083838724, 48.884146034401255],
          [2.2678492121266913, 48.882477547848566],
          [2.276943670041561, 48.87957757410604],
        ],
      },
    },
  ],
}
