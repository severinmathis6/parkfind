'use client'

import type { ReactNode } from 'react'

type Props = {
  active: boolean
  onClick: () => void
  children: ReactNode
}

export function FilterChip({ active, onClick, children }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        active
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}
