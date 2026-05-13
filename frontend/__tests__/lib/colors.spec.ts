import { describe, expect, it } from 'vitest'
import { availabilityColor, availabilityColorClass } from '@/lib/colors'

describe('availabilityColor', () => {
  it('returns green when ratio >= 0.3', () => {
    expect(availabilityColor(50, 100)).toBe('green')
    expect(availabilityColor(30, 100)).toBe('green')
  })

  it('returns yellow when 0.1 <= ratio < 0.3', () => {
    expect(availabilityColor(20, 100)).toBe('yellow')
    expect(availabilityColor(10, 100)).toBe('yellow')
  })

  it('returns red when ratio < 0.1', () => {
    expect(availabilityColor(5, 100)).toBe('red')
    expect(availabilityColor(0, 100)).toBe('red')
  })

  it('returns red when total is 0 or negative', () => {
    expect(availabilityColor(0, 0)).toBe('red')
    expect(availabilityColor(0, -5)).toBe('red')
  })

  it('returns green when available > total (degenerate)', () => {
    expect(availabilityColor(150, 100)).toBe('green')
  })
})

describe('availabilityColorClass', () => {
  it('returns Tailwind class for each color', () => {
    expect(availabilityColorClass('green')).toBe('bg-availability-green')
    expect(availabilityColorClass('yellow')).toBe('bg-availability-yellow')
    expect(availabilityColorClass('red')).toBe('bg-availability-red')
  })
})
