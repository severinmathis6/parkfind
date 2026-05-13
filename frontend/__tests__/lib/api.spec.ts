import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchNearbyParkings, fetchParkingById } from '@/lib/api'

const fetchMock = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://test-api')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  fetchMock.mockReset()
})

describe('fetchNearbyParkings', () => {
  it('builds the URL with lat/lng/radius and parses JSON', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [{ id: 1, name: 'A' }] })

    const result = await fetchNearbyParkings({ lat: 47.378, lng: 8.540, radius: 1000 })

    expect(fetchMock).toHaveBeenCalledOnce()
    const calledUrl = String(fetchMock.mock.calls[0][0])
    expect(calledUrl).toContain('http://test-api/api/parkings')
    expect(calledUrl).toContain('lat=47.378')
    expect(calledUrl).toContain('lng=8.54')
    expect(calledUrl).toContain('radius=1000')
    expect(result).toEqual([{ id: 1, name: 'A' }])
  })

  it('appends filter query params when provided', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [] })

    await fetchNearbyParkings({
      lat: 47.378,
      lng: 8.540,
      parkingType: ['street', 'garage'],
      isEvCharging: true,
      isFree: false,
    })

    const calledUrl = String(fetchMock.mock.calls[0][0])
    expect(calledUrl).toContain('parking_type=street%2Cgarage')
    expect(calledUrl).toContain('is_ev_charging=true')
    expect(calledUrl).toContain('is_free=false')
  })

  it('throws when response is not ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' })

    await expect(fetchNearbyParkings({ lat: 47.378, lng: 8.540 })).rejects.toThrow(/500/)
  })
})

describe('fetchParkingById', () => {
  it('fetches /api/parkings/:id and returns JSON', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 42, name: 'X' }) })

    const result = await fetchParkingById(42)

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(String(fetchMock.mock.calls[0][0])).toContain('http://test-api/api/parkings/42')
    expect(result).toEqual({ id: 42, name: 'X' })
  })

  it('throws on 404', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' })
    await expect(fetchParkingById(999)).rejects.toThrow(/404/)
  })
})
