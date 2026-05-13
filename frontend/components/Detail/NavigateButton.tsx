'use client'

import { useTranslations } from 'next-intl'

type Props = { lat: number; lng: number }

export function NavigateButton({ lat, lng }: Props) {
  const t = useTranslations('detail')

  function handleClick() {
    const dest = encodeURIComponent(`${lat},${lng}`)
    const url = `https://www.google.com/maps/dir/?api=1&destination=${dest}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
    >
      {t('navigate')}
    </button>
  )
}
