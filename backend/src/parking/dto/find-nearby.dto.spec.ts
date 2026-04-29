import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'
import { FindNearbyDto } from './find-nearby.dto'

describe('FindNearbyDto', () => {
  it('accepts valid lat/lng/radius', async () => {
    const dto = plainToInstance(FindNearbyDto, { lat: '47.378', lng: '8.540', radius: '2000' })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
    expect(dto.lat).toBe(47.378)
    expect(dto.lng).toBe(8.540)
    expect(dto.radius).toBe(2000)
  })

  it('uses default radius of 2000 when omitted', async () => {
    const dto = plainToInstance(FindNearbyDto, { lat: '47.378', lng: '8.540' })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
    expect(dto.radius).toBe(2000)
  })

  it('rejects out-of-range latitude', async () => {
    const dto = plainToInstance(FindNearbyDto, { lat: '95', lng: '8.540' })
    const errors = await validate(dto)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].property).toBe('lat')
  })

  it('rejects radius below 50 m', async () => {
    const dto = plainToInstance(FindNearbyDto, { lat: '47.378', lng: '8.540', radius: '10' })
    const errors = await validate(dto)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].property).toBe('radius')
  })

  it('rejects radius above 20000 m', async () => {
    const dto = plainToInstance(FindNearbyDto, { lat: '47.378', lng: '8.540', radius: '999999' })
    const errors = await validate(dto)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].property).toBe('radius')
  })

  it('parses parking_type CSV into array', async () => {
    const dto = plainToInstance(FindNearbyDto, {
      lat: '47.378',
      lng: '8.540',
      parking_type: 'street,garage',
    })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
    expect(dto.parking_type).toEqual(['street', 'garage'])
  })

  it('rejects unknown parking_type values', async () => {
    const dto = plainToInstance(FindNearbyDto, {
      lat: '47.378',
      lng: '8.540',
      parking_type: 'street,helipad',
    })
    const errors = await validate(dto)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors[0].property).toBe('parking_type')
  })

  it('parses is_ev_charging=true as boolean true', async () => {
    const dto = plainToInstance(FindNearbyDto, {
      lat: '47.378',
      lng: '8.540',
      is_ev_charging: 'true',
    })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
    expect(dto.is_ev_charging).toBe(true)
  })

  it('parses is_free=false as boolean false', async () => {
    const dto = plainToInstance(FindNearbyDto, {
      lat: '47.378',
      lng: '8.540',
      is_free: 'false',
    })
    const errors = await validate(dto)
    expect(errors).toHaveLength(0)
    expect(dto.is_free).toBe(false)
  })
})
