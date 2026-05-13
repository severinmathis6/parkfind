'use client'

import L from 'leaflet'
import { Marker, Popup } from 'react-leaflet'
import { availabilityColor } from '@/lib/colors'
import type { Parking } from '@/lib/types'

const ICON_CACHE = new Map<string, L.DivIcon>()

function iconForColor(color: 'green' | 'yellow' | 'red'): L.DivIcon {
  const cached = ICON_CACHE.get(color)
  if (cached !== undefined) return cached

  const fillColor = color === 'green' ? '#16a34a' : color === 'yellow' ? '#eab308' : '#dc2626'
  const html = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path fill="${fillColor}" stroke="white" stroke-width="1.5" d="M14 0C6.27 0 0 6.27 0 14c0 10 14 22 14 22s14-12 14-22c0-7.73-6.27-14-14-14z"/><circle cx="14" cy="14" r="5" fill="white"/></svg>`
  const icon = L.divIcon({
    className: 'parking-marker',
    html,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -32],
  })
  ICON_CACHE.set(color, icon)
  return icon
}

type Props = {
  parking: Parking
  onClick: (id: number) => void
}

export function ParkingMarker({ parking, onClick }: Props) {
  const color = availabilityColor(parking.availableSpots, parking.totalSpots)
  return (
    <Marker
      position={[parking.latitude, parking.longitude]}
      icon={iconForColor(color)}
      eventHandlers={{ click: () => onClick(parking.id) }}
    >
      <Popup>
        <strong>{parking.name}</strong>
        <br />
        {parking.availableSpots} / {parking.totalSpots}
      </Popup>
    </Marker>
  )
}
