export type AvailabilityColor = 'green' | 'yellow' | 'red'

export function availabilityColor(available: number, total: number): AvailabilityColor {
  if (total <= 0) return 'red'
  const ratio = available / total
  if (ratio >= 0.3) return 'green'
  if (ratio >= 0.1) return 'yellow'
  return 'red'
}

export function availabilityColorClass(color: AvailabilityColor): string {
  switch (color) {
    case 'green':
      return 'bg-availability-green'
    case 'yellow':
      return 'bg-availability-yellow'
    case 'red':
      return 'bg-availability-red'
  }
}
