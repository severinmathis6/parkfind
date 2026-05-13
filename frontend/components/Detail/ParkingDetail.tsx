'use client'

import { useTranslations } from 'next-intl'
import type { Parking } from '@/lib/types'
import { NavigateButton } from './NavigateButton'

type Props = {
  parking: Parking | null
  onClose: () => void
}

export function ParkingDetail({ parking, onClose }: Props) {
  const t = useTranslations('detail')

  if (parking === null) return null

  return (
    <aside
      role="dialog"
      aria-label={parking.name}
      className="absolute bottom-0 left-0 right-0 z-[1000] max-h-[70vh] overflow-y-auto rounded-t-xl bg-white p-4 shadow-2xl sm:bottom-4 sm:left-auto sm:right-4 sm:top-16 sm:max-h-none sm:w-96 sm:rounded-xl"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{parking.name}</h2>
          <p className="text-sm text-gray-600">{parking.address}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      <dl className="mb-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-500">{t('available')}</dt>
          <dd className="font-medium text-gray-900">
            {parking.availableSpots} {t('of')} {parking.totalSpots}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">{t('price_per_hour')}</dt>
          <dd className="font-medium text-gray-900">
            {parking.pricePerHour === 0
              ? t('free')
              : `CHF ${parking.pricePerHour.toFixed(2)}`}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">⚡</dt>
          <dd className="font-medium text-gray-900">
            {parking.isEvCharging ? t('ev_charging') : t('no_ev_charging')}
          </dd>
        </div>
        {parking.maxHeight !== null && (
          <div className="flex justify-between">
            <dt className="text-gray-500">{t('max_height')}</dt>
            <dd className="font-medium text-gray-900">{parking.maxHeight.toFixed(2)} m</dd>
          </div>
        )}
        {parking.openingHours !== null && (
          <div className="flex justify-between">
            <dt className="text-gray-500">{t('opening_hours')}</dt>
            <dd className="font-medium text-gray-900">{parking.openingHours}</dd>
          </div>
        )}
      </dl>

      <NavigateButton lat={parking.latitude} lng={parking.longitude} />
    </aside>
  )
}
