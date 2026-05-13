import { describe, expect, it } from 'vitest'
import { paramsToFilters, filtersToSearchParams } from '@/lib/url-state'

describe('paramsToFilters', () => {
  it('returns empty filters for empty search params', () => {
    const params = new URLSearchParams()
    expect(paramsToFilters(params)).toEqual({})
  })

  it('parses parking_type CSV into array', () => {
    const params = new URLSearchParams({ parking_type: 'street,garage' })
    expect(paramsToFilters(params)).toEqual({ parkingType: ['street', 'garage'] })
  })

  it('parses is_free=true', () => {
    const params = new URLSearchParams({ is_free: 'true' })
    expect(paramsToFilters(params)).toEqual({ isFree: true })
  })

  it('parses is_ev_charging=true', () => {
    const params = new URLSearchParams({ is_ev_charging: 'true' })
    expect(paramsToFilters(params)).toEqual({ isEvCharging: true })
  })

  it('ignores unknown parking_type values', () => {
    const params = new URLSearchParams({ parking_type: 'street,unicorn' })
    expect(paramsToFilters(params)).toEqual({ parkingType: ['street'] })
  })
})

describe('filtersToSearchParams', () => {
  it('returns empty params for empty filters', () => {
    expect(filtersToSearchParams({}).toString()).toBe('')
  })

  it('serializes parkingType as CSV', () => {
    const params = filtersToSearchParams({ parkingType: ['street', 'garage'] })
    expect(params.get('parking_type')).toBe('street,garage')
  })

  it('serializes isFree=true', () => {
    const params = filtersToSearchParams({ isFree: true })
    expect(params.get('is_free')).toBe('true')
  })

  it('omits empty parkingType array', () => {
    expect(filtersToSearchParams({ parkingType: [] }).toString()).toBe('')
  })
})
