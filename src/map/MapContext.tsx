import { createContext, useContext } from 'react'
import type { Map as MLMap } from 'maplibre-gl'

export const MapContext = createContext<MLMap | null>(null)

export function useMap(): MLMap {
  const m = useContext(MapContext)
  if (!m) throw new Error('useMap must be used inside <MapCanvas>')
  return m
}

export function useMapMaybe(): MLMap | null {
  return useContext(MapContext)
}
