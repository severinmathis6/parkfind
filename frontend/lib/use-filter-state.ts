'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { usePathname } from '@/i18n/routing'
import { filtersToSearchParams, paramsToFilters, type Filters } from './url-state'

export function useFilterState(): [Filters, (filters: Filters) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const filters = paramsToFilters(new URLSearchParams(params.toString()))

  function setFilters(next: Filters) {
    const newParams = filtersToSearchParams(next).toString()
    const url = newParams === '' ? pathname : `${pathname}?${newParams}`
    router.replace(url, { scroll: false })
  }

  return [filters, setFilters]
}
