'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { Coords } from '@/lib/types'

type Props = {
  onLocate: (coords: Coords) => void
  onError?: (err: unknown) => void
}

export function LocationButton({ onLocate, onError }: Props) {
  const t = useTranslations('location')
  const [loading, setLoading] = useState(false)

  function handleClick() {
    if (typeof navigator === 'undefined' || navigator.geolocation === undefined) {
      onError?.(new Error('Geolocation not supported'))
      return
    }
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false)
        onLocate({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      (err) => {
        setLoading(false)
        onError?.(err)
      },
      { enableHighAccuracy: false, timeout: 8000 },
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="rounded border border-gray-300 bg-white px-3 py-1 text-sm hover:bg-gray-50 disabled:opacity-60"
    >
      {loading ? t('loading') : t('locate_me')}
    </button>
  )
}
