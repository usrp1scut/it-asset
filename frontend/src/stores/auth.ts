import { create } from 'zustand'

export interface CurrentUser {
  id: number
  name: string
  email: string | null
  role: string
  status: string
}

interface AuthState {
  token: string | null
  user: CurrentUser | null
  setAuth: (token: string, user: CurrentUser) => void
  setUser: (user: CurrentUser) => void
  logout: () => void
}

const TOKEN_KEY = 'it_asset_token'

export const useAuth = create<AuthState>((set) => ({
  token: localStorage.getItem(TOKEN_KEY),
  user: null,
  setAuth: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token)
    set({ token, user })
  },
  setUser: (user) => set({ user }),
  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    set({ token: null, user: null })
  },
}))
