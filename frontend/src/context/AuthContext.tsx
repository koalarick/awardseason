import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import api from '../services/api'

export interface AuthUser {
  id: string
  email: string
  role: string
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  setAuth: (token: string, user: AuthUser) => void
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    if (storedToken) {
      setToken(storedToken)
      fetchUser(storedToken)
    } else {
      setLoading(false)
    }
  }, [])

  const fetchUser = async (authToken: string) => {
    try {
      const response = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      })
      setUser(response.data.user)
    } catch (error) {
      localStorage.removeItem('token')
      setToken(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password })
    const { token: newToken, user: newUser } = response.data
    setToken(newToken)
    setUser(newUser)
    localStorage.setItem('token', newToken)
  }

  const register = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/register', { email, password })
      const { token: newToken, user: newUser } = response.data
      setToken(newToken)
      setUser(newUser)
      localStorage.setItem('token', newToken)
    } catch (error: any) {
      // Re-throw with better error message for network/CORS issues
      if (!error.response) {
        throw new Error('Network error: Could not connect to server. Make sure you are on the same WiFi network and using the correct IP address.')
      }
      throw error
    }
  }

  const setAuth = (newToken: string, newUser: AuthUser) => {
    setToken(newToken)
    setUser(newUser)
    localStorage.setItem('token', newToken)
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('token')
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, setAuth, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
