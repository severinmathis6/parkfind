'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'

type MapClientType = typeof import('./MapClient').default

const MapClient = dynamic<ComponentProps<MapClientType>>(
  () => import('./MapClient'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-500">
        Lade Karte...
      </div>
    ),
  },
)

export const MapContainer = MapClient
