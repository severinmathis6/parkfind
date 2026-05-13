import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it, vi } from 'vitest'
import { FilterBar } from '@/components/Filters/FilterBar'
import deMessages from '@/i18n/messages/de.json'

function renderBar(props: Partial<React.ComponentProps<typeof FilterBar>> = {}) {
  const defaultProps: React.ComponentProps<typeof FilterBar> = {
    filters: {},
    onChange: () => {},
  }
  return render(
    <NextIntlClientProvider locale="de" messages={deMessages}>
      <FilterBar {...defaultProps} {...props} />
    </NextIntlClientProvider>,
  )
}

describe('FilterBar', () => {
  it('renders all three type chips and two toggles', () => {
    renderBar()
    expect(screen.getByRole('button', { name: /strasse/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /parkhaus/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /privat/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /kostenlos/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ladestation/i })).toBeInTheDocument()
  })

  it('marks active chip as aria-pressed=true', () => {
    renderBar({ filters: { parkingType: ['garage'] } })
    expect(screen.getByRole('button', { name: /parkhaus/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /strasse/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('calls onChange with toggled type when chip clicked', async () => {
    const onChange = vi.fn()
    renderBar({ onChange })
    await userEvent.click(screen.getByRole('button', { name: /strasse/i }))
    expect(onChange).toHaveBeenLastCalledWith({ parkingType: ['street'] })
  })

  it('removes type from array on second click', async () => {
    const onChange = vi.fn()
    renderBar({ filters: { parkingType: ['street', 'garage'] }, onChange })
    await userEvent.click(screen.getByRole('button', { name: /strasse/i }))
    expect(onChange).toHaveBeenLastCalledWith({ parkingType: ['garage'] })
  })

  it('toggles isFree on click', async () => {
    const onChange = vi.fn()
    renderBar({ onChange })
    await userEvent.click(screen.getByRole('button', { name: /kostenlos/i }))
    expect(onChange).toHaveBeenLastCalledWith({ isFree: true })
  })

  it('toggles isEvCharging on click', async () => {
    const onChange = vi.fn()
    renderBar({ filters: { isEvCharging: true }, onChange })
    await userEvent.click(screen.getByRole('button', { name: /ladestation/i }))
    expect(onChange).toHaveBeenLastCalledWith({})
  })
})
