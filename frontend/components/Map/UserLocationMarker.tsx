'use client'

import { CircleMarker } from 'react-leaflet'
import type { Coords } from '@/lib/types'

type Props = { coords: Coords }

export function UserLocationMarker({ coords }: Props) {
  return (
    <CircleMarker
      center={[coords.lat, coords.lng]}
      radius={8}
      pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.7, weight: 2 }}
    />
  )
}
