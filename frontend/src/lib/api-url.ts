const RAW_ENV_BASE = process.env.NEXT_PUBLIC_API_URL?.trim() || ''
const DEFAULT_PRODUCTION_BASE = 'https://comply-x.onrender.com'

const sanitizedEnvBase = RAW_ENV_BASE.replace(/\/+$/, '')

const API_BASE_URL =
  sanitizedEnvBase || (process.env.NODE_ENV === 'development' ? '' : DEFAULT_PRODUCTION_BASE)

const hasExplicitBase = sanitizedEnvBase.length > 0
const hasDefaultBase = API_BASE_URL.length > 0

function combinePath(base: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (!base) {
    return normalizedPath
  }

  const baseWithoutTrailing = base.replace(/\/+$/, '')
  const isApiBase = /\/api$/i.test(baseWithoutTrailing)
  const lowerPath = normalizedPath.toLowerCase()

  if (isApiBase) {
    if (lowerPath === '/api') {
      return baseWithoutTrailing
    }

    if (lowerPath.startsWith('/api/')) {
      return `${baseWithoutTrailing}${normalizedPath.slice(4)}`
    }
  }

  return `${baseWithoutTrailing}${normalizedPath}`
}

export function getApiBaseUrl(): string {
  return API_BASE_URL
}

export function isApiBaseConfigured(): boolean {
  if (hasExplicitBase || hasDefaultBase) {
    return true
  }

  if (typeof window !== 'undefined') {
    return true
  }

  return process.env.NODE_ENV !== 'production'
}

export function buildApiUrl(path: string): string {
  return combinePath(API_BASE_URL, path)
}
