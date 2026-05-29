import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useTourStore } from '@/store/tour-store'
import { useMapMaybe } from '@/map/MapContext'
import { STEPS } from './steps'
import { addBuildings3D } from '@/map/layers/buildings3d'
import { Play } from 'lucide-react'

export function StartScreen() {
  const start = useTourStore((s) => s.start)
  const map = useMapMaybe()
  const addedRef = useRef(false)

  useEffect(() => {
    if (!map || addedRef.current) return
    addedRef.current = true
    // Drop the 3D buildings in so the idle cinematic rotation has something to chew on.
    if (map.isStyleLoaded()) addBuildings3D(map)
    else map.once('idle', () => addBuildings3D(map))
  }, [map])

  return (
    <div
      className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      style={{ zIndex: 100200 }}
    >
      <Card className="max-w-xl mx-4 text-center">
        <CardHeader className="items-center gap-3">
          <Badge variant="outline" className="mx-auto">
            DaVikingCode · GIS preview
          </Badge>
          <CardTitle className="text-3xl">Une démo de nos capacités cartographiques</CardTitle>
          <CardDescription className="text-balance">
            {STEPS.length} étapes : bâtiments 3D, modèles animés, fonds de plan, vecteurs stylés,
            mesure, overlays raster, heatmaps et POI cliquables. Chaque étape déplace la caméra et
            active une capacité.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button size="lg" onClick={start}>
            <Play /> Démarrer la visite
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
