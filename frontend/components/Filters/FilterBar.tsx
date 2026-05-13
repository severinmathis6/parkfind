'use client'

import { useTranslations } from 'next-intl'
import { PARKING_TYPES, type ParkingType } from '@/lib/types'
import type { Filters } from '@/lib/url-state'
import { FilterChip } from './FilterChip'

type Props = {
  filters: Filters
  onChange: (next: Filters) => void
}

export function FilterBar({ filters, onChange }: Props) {
  const t = useTranslations('filters')

  function toggleType(type: ParkingType) {
    const current = filters.parkingType ?? []
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type]
    const updated: Filters = { ...filters }
    if (next.length > 0) updated.parkingType = next
    else delete updated.parkingType
    onChange(updated)
  }

  function toggleBool(key: 'isFree' | 'isEvCharging') {
    const updated: Filters = { ...filters }
    if (filters[key] === true) delete updated[key]
    else updated[key] = true
    onChange(updated)
  }

  const typeLabels: Record<ParkingType, string> = {
    street: t('type_street'),
    garage: t('type_garage'),
    private: t('type_private'),
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PARKING_TYPES.map((type) => (
        <FilterChip
          key={type}
          active={(filters.parkingType ?? []).includes(type)}
          onClick={() => toggleType(type)}
        >
          {typeLabels[type]}
        </FilterChip>
      ))}
      <FilterChip active={filters.isFree === true} onClick={() => toggleBool('isFree')}>
        {t('is_free_label')}
      </FilterChip>
      <FilterChip
        active={filters.isEvCharging === true}
        onClick={() => toggleBool('isEvCharging')}
      >
        {t('ev_charging_label')}
      </FilterChip>
    </div>
  )
}
