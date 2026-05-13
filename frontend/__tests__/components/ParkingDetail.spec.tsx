import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import { ParkingDetail } from '@/components/Detail/ParkingDetail'
import deMessages from '@/i18n/messages/de.json'
import type { Parking } from '@/lib/types'

const PARKING: Parking = {
  id: 1,
  name: 'PH Hohe Promenade',
  address: 'Promenadengasse 1, 8001 Zürich',
  city: 'Zürich',
  parkingType: 'garage',
  latitude: 47.37,
  longitude: 8.5453,
  totalSpots: 220,
  availableSpots: 130,
  pricePerHour: 4.5,
  isEvCharging: true,
  maxHeight: 2.1,
  openingHours: '24/7',
}

function renderDetail(parking: Parking | null, onClose = vi.fn()) {
  return render(
    <NextIntlClientProvider locale="de" messages={deMessages}>
      <ParkingDetail parking={parking} onClose={onClose} />
    </NextIntlClientProvider>,
  )
}

describe('ParkingDetail', () => {
  it('renders nothing when parking is null', () => {
    const { container } = renderDetail(null)
    expect(container.firstChild).toBeNull()
  })

  it('renders the parking name and address', () => {
    renderDetail(PARKING)
    expect(screen.getByText('PH Hohe Promenade')).toBeInTheDocument()
    expect(screen.getByText('Promenadengasse 1, 8001 Zürich')).toBeInTheDocument()
  })

  it('shows availability count', () => {
    renderDetail(PARKING)
    expect(screen.getByText(/130/)).toBeInTheDocument()
    expect(screen.getByText(/220/)).toBeInTheDocument()
  })

  it('shows price per hour with CHF', () => {
    renderDetail(PARKING)
    expect(screen.getByText(/CHF 4\.50/i)).toBeInTheDocument()
  })

  it('shows free label when pricePerHour is 0', () => {
    renderDetail({ ...PARKING, pricePerHour: 0 })
    expect(screen.getByText(/kostenlos/i)).toBeInTheDocument()
  })

  it('shows EV charging info when available', () => {
    renderDetail(PARKING)
    expect(screen.getByText(/Ladestation verfügbar/i)).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn()
    renderDetail(PARKING, onClose)
    await userEvent.click(screen.getByRole('button', { name: /schliessen/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
