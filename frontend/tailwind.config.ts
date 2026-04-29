import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        availability: {
          green: '#16a34a',
          yellow: '#eab308',
          red: '#dc2626',
        },
      },
    },
  },
  plugins: [],
}

export default config
