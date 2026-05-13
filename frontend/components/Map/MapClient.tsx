'use client'

import 'leaflet/dist/leaflet.css'
import { MapContainer as LeafletMap, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { useEffect } from 'react'
import { ParkingMarker } from './ParkingMarker'
import { UserLocationMarker } from './UserLocationMarker'
import type { Coords, Parking } from '@/lib/types'

type Props = {
  center: Coords
  parkings: Parking[]
  userCoords: Coords | null
  onMoveEnd: (coords: Coords) => void
  onMarkerClick: (id: number) => void
}

function MapEvents({ onMoveEnd }: { onMoveEnd: (coords: Coords) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const c = map.getCenter()
      onMoveEnd({ lat: c.lat, lng: c.lng })
    },
  })
  return null
}

function CenterUpdater({ center }: { center: Coords }) {
  const map = useMap()
  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom())
  }, [center.lat, center.lng, map])
  return null
}

export default function MapClient({ center, parkings, userCoords, onMoveEnd, onMarkerClick }: Props) {
  return (
    <LeafletMap
      center={[center.lat, center.lng]}
      zoom={14}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CenterUpdater center={center} />
      <MapEvents onMoveEnd={onMoveEnd} />
      {userCoords !== null && <UserLocationMarker coords={userCoords} />}
      {parkings.map((p) => (
        <ParkingMarker key={p.id} parking={p} onClick={onMarkerClick} />
      ))}
    </LeafletMap>
  )
}
