import axios from 'axios'

const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "/api"
    : process.env.NEXT_PUBLIC_API_URL || "/api"

// const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface User {
  id: number
  email: string
  username: string
  first_name: string
  last_name: string
  role: 'admin' | 'manager' | 'auditor' | 'employee' | 'viewer'
  is_active: boolean
  is_verified: boolean
  created_at: string
  last_login?: string
  phone?: string
  department?: string
  position?: string
  avatar_url?: string
}

export interface LoginCredentials {
  username: string
  password: string
  mfa_code?: string
}

export interface RegisterData {
  email: string
  username: string
  first_name: string
  last_name: string
  password: string
  phone?: string
  department?: string
  position?: string
  role?: 'admin' | 'manager' | 'auditor' | 'employee' | 'viewer'
}

export interface AuthResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: User
}

class AuthService {
  private apiClient = axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  constructor() {
    // Add request interceptor to include token
    this.apiClient.interceptors.request.use(
      (config) => {
        const token = this.getToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Add response interceptor to handle token expiration
    this.apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401 && typeof window !== 'undefined') {
          // Only auto-redirect if we're not already on the login page
          // and if this is a token expiration (not a login attempt)
          const currentPath = window.location.pathname
          const isLoginAttempt = error.config?.url?.includes('/auth/login')
          
          if (!isLoginAttempt && currentPath !== '/login') {
            this.clearToken()
            window.location.href = '/login'
          }
        }
        return Promise.reject(error)
      }
    )
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const endpoint = credentials.mfa_code ? '/auth/mfa/login' : '/auth/login'
    const response = await this.apiClient.post(endpoint, credentials)
    const authData = response.data
    this.setToken(authData.access_token)
    return authData
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.apiClient.post('/auth/password-reset/request', { email })
  }

  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    await this.apiClient.post('/auth/password-reset/confirm', {
      token,
      new_password: newPassword
    })
  }

  async getMFAStatus(): Promise<{enabled: boolean, methods: string[]}> {
    const response = await this.apiClient.get('/auth/mfa/status')
    return response.data
  }

  async setupMFA(password: string): Promise<{secret: string, qr_code: string, backup_codes: string[]}> {
    const response = await this.apiClient.post('/auth/mfa/setup', { password })
    return response.data
  }

  async verifyMFA(secret: string, verificationCode: string, backupCodes: string[]): Promise<void> {
    await this.apiClient.post('/auth/mfa/verify', {
      secret,
      verification_code: verificationCode,
      backup_codes: backupCodes
    })
  }

  async disableMFA(password: string): Promise<void> {
    await this.apiClient.post('/auth/mfa/disable', { password })
  }

  async register(userData: RegisterData): Promise<User> {
    const response = await this.apiClient.post('/auth/register', userData)
    return response.data
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.apiClient.get('/auth/me')
    return response.data
  }

  async getUsers(): Promise<User[]> {
    const response = await this.apiClient.get('/auth/users')
    return response.data
  }

  logout(): void {
    this.clearToken()
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
  }

  private setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_token', token)
    }
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('auth_token')
  }

  private clearToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
    }
  }

  isAuthenticated(): boolean {
    return !!this.getToken()
  }
}

export const authService = new AuthService()