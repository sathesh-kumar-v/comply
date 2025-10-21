export interface CountryOption {
  code: string
  name: string
  region: string
  lat: number
  lon: number
}

export const COUNTRY_OPTIONS: CountryOption[] = [
  { code: 'US', name: 'United States', region: 'North America', lat: 38.0, lon: -97.0 },
  { code: 'CA', name: 'Canada', region: 'North America', lat: 56.0, lon: -106.0 },
  { code: 'MX', name: 'Mexico', region: 'North America', lat: 23.6, lon: -102.5 },
  { code: 'BR', name: 'Brazil', region: 'South America', lat: -14.2, lon: -51.9 },
  { code: 'AR', name: 'Argentina', region: 'South America', lat: -38.4, lon: -63.6 },
  { code: 'CL', name: 'Chile', region: 'South America', lat: -35.7, lon: -71.5 },
  { code: 'GB', name: 'United Kingdom', region: 'Europe', lat: 55.4, lon: -3.4 },
  { code: 'DE', name: 'Germany', region: 'Europe', lat: 51.2, lon: 10.4 },
  { code: 'FR', name: 'France', region: 'Europe', lat: 46.2, lon: 2.2 },
  { code: 'ES', name: 'Spain', region: 'Europe', lat: 40.5, lon: -3.7 },
  { code: 'IT', name: 'Italy', region: 'Europe', lat: 41.8, lon: 12.5 },
  { code: 'PL', name: 'Poland', region: 'Europe', lat: 52.0, lon: 19.1 },
  { code: 'SE', name: 'Sweden', region: 'Europe', lat: 60.1, lon: 18.6 },
  { code: 'NG', name: 'Nigeria', region: 'Africa', lat: 9.1, lon: 8.7 },
  { code: 'ZA', name: 'South Africa', region: 'Africa', lat: -30.6, lon: 22.9 },
  { code: 'KE', name: 'Kenya', region: 'Africa', lat: -0.0, lon: 37.9 },
  { code: 'EG', name: 'Egypt', region: 'Africa', lat: 26.8, lon: 30.8 },
  { code: 'CN', name: 'China', region: 'Asia', lat: 35.8, lon: 104.2 },
  { code: 'JP', name: 'Japan', region: 'Asia', lat: 37.5, lon: 137.0 },
  { code: 'IN', name: 'India', region: 'Asia', lat: 21.1, lon: 78.0 },
  { code: 'SG', name: 'Singapore', region: 'Asia', lat: 1.35, lon: 103.8 },
  { code: 'AU', name: 'Australia', region: 'Oceania', lat: -25.2, lon: 133.8 },
  { code: 'NZ', name: 'New Zealand', region: 'Oceania', lat: -41.2, lon: 174.8 },
  { code: 'AE', name: 'United Arab Emirates', region: 'Middle East', lat: 23.4, lon: 54.4 },
  { code: 'SA', name: 'Saudi Arabia', region: 'Middle East', lat: 24.0, lon: 45.0 },
  { code: 'QA', name: 'Qatar', region: 'Middle East', lat: 25.3, lon: 51.2 },
  { code: 'TR', name: 'Turkey', region: 'Europe / Asia', lat: 39.0, lon: 35.2 },
  { code: 'RU', name: 'Russia', region: 'Europe / Asia', lat: 61.5, lon: 105.3 },
  { code: 'KR', name: 'South Korea', region: 'Asia', lat: 36.5, lon: 128.0 },
  { code: 'ID', name: 'Indonesia', region: 'Asia', lat: -2.5, lon: 118.0 },
  { code: 'TH', name: 'Thailand', region: 'Asia', lat: 15.8, lon: 100.9 },
  { code: 'PH', name: 'Philippines', region: 'Asia', lat: 12.9, lon: 122.9 },
  { code: 'CO', name: 'Colombia', region: 'South America', lat: 4.6, lon: -74.1 },
  { code: 'PE', name: 'Peru', region: 'South America', lat: -9.2, lon: -75.0 },
  { code: 'CH', name: 'Switzerland', region: 'Europe', lat: 46.8, lon: 8.2 },
  { code: 'BE', name: 'Belgium', region: 'Europe', lat: 50.5, lon: 4.5 },
  { code: 'NL', name: 'Netherlands', region: 'Europe', lat: 52.1, lon: 5.3 },
]

export const TEAM_MEMBERS: Array<{ id: string; name: string; role: string }> = [
  { id: 'risk-ana-1', name: 'Daniel Alvarez', role: 'Regional Risk Lead' },
  { id: 'risk-ana-2', name: 'Sara Ibrahim', role: 'Political Analyst' },
  { id: 'risk-ana-3', name: 'Lina Chen', role: 'Compliance Strategist' },
  { id: 'risk-ana-4', name: 'Marta Rossi', role: 'Economic Intelligence' },
  { id: 'risk-ana-5', name: 'Noah Patel', role: 'Operational Resilience' },
  { id: 'risk-ana-6', name: 'Emily Carter', role: 'Audit Integration Lead' },
  { id: 'risk-ana-7', name: 'Jamal Okafor', role: 'Regulatory Counsel' },
]
