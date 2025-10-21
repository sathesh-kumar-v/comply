import type { RiskCountryMapEntry } from '@/types/risk'

const MAP_WIDTH = 1000
const MAP_HEIGHT = 520

export function projectPoint(lat: number, lon: number): { x: number; y: number } {
  const x = ((lon + 180) / 360) * MAP_WIDTH
  const y = ((90 - lat) / 180) * MAP_HEIGHT
  return { x, y }
}

export function getRiskColor(entry?: Pick<RiskCountryMapEntry, 'score' | 'riskLevel'> | null): string {
  if (!entry) {
    return '#d1d5db'
  }
  const score = entry.score
  if (score <= 25) return '#34d399'
  if (score <= 50) return '#facc15'
  if (score <= 75) return '#fb923c'
  return '#f87171'
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

export const mapDimensions = { width: MAP_WIDTH, height: MAP_HEIGHT }
