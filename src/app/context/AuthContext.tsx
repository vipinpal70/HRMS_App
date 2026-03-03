'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

export type UserRole = 'emp' | 'admin' | 'hr'

interface Profile {
  id: string
  name: string
  email: string
  role: UserRole
  emp_id?: string
  designation?: string
  department?: string // Not in schema yet, but in old interface
  avatar?: string // Not in schema yet
}

interface AuthContextType {
  user: Profile | null
  loading: boolean
  login: () => void // login is handled by server action or redirect
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null) // Relax type for now to avoid errors
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  // Create Supabase client once
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    const fetchProfile = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single()

        if (error) {
          console.error('Error fetching profile:', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint
          })
          return null
        }
        return data
      } catch (error) {
        console.error('Unexpected error fetching profile:', error)
        return null
      }
    }

    const initializeAuth = async () => {
      try {
        setLoading(true);
        // 1. Check for tokens in URL fragment (Implicit Flow / Magic Links)
        if (typeof window !== 'undefined' && window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken && refreshToken) {
            console.log('Found tokens in URL hash, setting session...');
            const { data: { session }, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (!sessionError && session) {
              console.log('Session established from hash tokens');
              const profile = await fetchProfile(session.user.id);
              setUser(profile || {
                id: session.user.id,
                name: session.user.user_metadata.full_name || session.user.email?.split('@')[0] || 'User',
                email: session.user.email!,
                role: 'emp'
              });

              // Clear hash and redirect to home
              window.history.replaceState(null, '', window.location.pathname);
              if (window.location.pathname === '/login') {
                router.push('/');
              }
              setLoading(false);
              return;
            }
          }
        }

        // 2. Fallback to standard getSession
        const { data: { session } } = await supabase.auth.getSession()

        if (session?.user) {
          console.log('Session found for:', session.user.email);
          const profile = await fetchProfile(session.user.id)

          if (profile) {
            setUser(profile)
          } else {
            // Fallback profile
            setUser({
              id: session.user.id,
              name: session.user.user_metadata.full_name || session.user.email?.split('@')[0] || 'User',
              email: session.user.email!,
              role: 'emp'
            })
          }

          // Redirect if on login page
          if (window.location.pathname === '/login' || window.location.pathname === '/auth') {
            router.push('/');
          }

        } else {
          console.log('No active session found');
          setUser(null)
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      if (event === 'SIGNED_IN' && session?.user) {
        // 1. Immediate UI Unblock: Set user from session data first
        const fallbackUser = {
          id: session.user.id,
          name: session.user.user_metadata.full_name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email!,
          role: 'emp' as UserRole
        };
        setUser(fallbackUser);
        setLoading(false); // Stop spinner immediately

        // 2. Background Fetch: Get full profile (role, avatar, etc.)
        fetchProfile(session.user.id).then(profile => {
          if (profile) {
            console.log('Profile updated in background:', profile.role);
            setUser(profile);
          }
        });

        // Force redirect to dashboard on sign in
        if (window.location.pathname === '/login') {
          router.push('/')
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setLoading(false); // Ensure loading is cleared on sign-out
        // router.refresh()
        router.push('/login')
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])

  const login = () => {
    router.push('/login')
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/login')
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
