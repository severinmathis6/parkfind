'use client'

import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { LocaleSwitcher } from './LocaleSwitcher'

export function TopBar({ children }: { children?: ReactNode }) {
  const t = useTranslations('app')

  return (
    <header className="absolute left-0 right-0 top-0 z-[1000] flex items-center justify-between gap-4 bg-white/95 px-4 py-2 shadow-sm backdrop-blur">
      <h1 className="text-base font-semibold text-gray-900 sm:text-lg">{t('title')}</h1>
      <div className="flex items-center gap-2">
        {children}
        <LocaleSwitcher />
      </div>
    </header>
  )
}
