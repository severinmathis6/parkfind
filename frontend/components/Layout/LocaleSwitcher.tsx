'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/routing'

export function LocaleSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const t = useTranslations('locale')

  const otherLocale = locale === 'de' ? 'en' : 'de'

  return (
    <button
      type="button"
      onClick={() => router.replace(pathname, { locale: otherLocale })}
      className="rounded border border-gray-300 bg-white px-3 py-1 text-sm hover:bg-gray-50"
      aria-label={`Switch to ${t(otherLocale)}`}
    >
      {t(otherLocale)}
    </button>
  )
}
