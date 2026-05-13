import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NavigateButton } from '@/components/Detail/NavigateButton'
import deMessages from '@/i18n/messages/de.json'

function renderBtn(lat: number, lng: number) {
  return render(
    <NextIntlClientProvider locale="de" messages={deMessages}>
      <NavigateButton lat={lat} lng={lng} />
    </NextIntlClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('NavigateButton', () => {
  it('renders the navigate label', () => {
    renderBtn(47.378, 8.540)
    expect(screen.getByRole('button', { name: /navigation starten/i })).toBeInTheDocument()
  })

  it('opens Google Maps URL in a new tab when clicked', async () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)

    renderBtn(47.378, 8.540)
    await userEvent.click(screen.getByRole('button'))

    expect(open).toHaveBeenCalledWith(
      'https://www.google.com/maps/dir/?api=1&destination=47.378%2C8.54',
      '_blank',
      'noopener,noreferrer',
    )
  })
})
