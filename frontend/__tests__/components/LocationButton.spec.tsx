import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import { LocationButton } from '@/components/Location/LocationButton'
import deMessages from '@/i18n/messages/de.json'

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="de" messages={deMessages}>
      {ui}
    </NextIntlClientProvider>,
  )
}

describe('LocationButton', () => {
  it('renders the locate-me label', () => {
    renderWithIntl(<LocationButton onLocate={() => {}} />)
    expect(screen.getByRole('button', { name: /standort verwenden/i })).toBeInTheDocument()
  })

  it('calls onLocate with coords when geolocation succeeds', async () => {
    const onLocate = vi.fn()
    const getCurrentPosition = vi.fn((success) => {
      success({ coords: { latitude: 47.378, longitude: 8.540 } })
    })
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })

    renderWithIntl(<LocationButton onLocate={onLocate} />)
    await userEvent.click(screen.getByRole('button'))

    expect(onLocate).toHaveBeenCalledWith({ lat: 47.378, lng: 8.540 })
    vi.unstubAllGlobals()
  })

  it('calls onError when geolocation is denied', async () => {
    const onError = vi.fn()
    const getCurrentPosition = vi.fn((_, error) => {
      error({ code: 1, message: 'denied' })
    })
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })

    renderWithIntl(<LocationButton onLocate={() => {}} onError={onError} />)
    await userEvent.click(screen.getByRole('button'))

    expect(onError).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
