// Tipos del módulo 10-core-auth.
// Shape real validado contra https://dev.alfredo.mx/v1/auth/login.

export type UserRole = 'admin' | 'viewer'
export type UserStatus = 'active' | 'disabled'

export interface User {
  id: string
  email: string
  fullName: string
  role: UserRole
  status: UserStatus
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  accessToken: string
  user: User
}

export type MeResponse = User
