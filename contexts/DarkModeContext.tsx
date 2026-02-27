// contexts/DarkModeContext.tsx
'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

interface DarkModeContextType {
  isDark: boolean
  toggle: () => void
  setDark: (dark: boolean) => void
  mounted: boolean
}

const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined)

export function DarkModeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      setMounted(true)
      
      // Check localStorage first, then system preference
      const stored = localStorage.getItem('darkMode')
      if (stored !== null) {
        setIsDark(stored === 'true')
      } else {
        // Check system preference
        if (typeof window !== 'undefined' && window.matchMedia) {
          const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
          setIsDark(systemDark)
        }
      }
    } catch (error) {
      console.error('Error initializing dark mode:', error)
      setIsDark(false) // Default to light mode if there's an error
    }
  }, [])

  useEffect(() => {
    if (!mounted) return
    
    try {
      // Update document class and localStorage
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', isDark)
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem('darkMode', isDark.toString())
      }
    } catch (error) {
      console.error('Error updating dark mode:', error)
    }
  }, [isDark, mounted])

  const toggle = () => {
    try {
      setIsDark(prev => !prev)
    } catch (error) {
      console.error('Error toggling dark mode:', error)
    }
  }

  const setDark = (dark: boolean) => {
    try {
      setIsDark(dark)
    } catch (error) {
      console.error('Error setting dark mode:', error)
    }
  }

  const value = {
    isDark,
    toggle,
    setDark,
    mounted
  }

  return (
    <DarkModeContext.Provider value={value}>
      {children}
    </DarkModeContext.Provider>
  )
}

export const useDarkMode = () => {
  const context = useContext(DarkModeContext)
  if (context === undefined) {
    throw new Error('useDarkMode must be used within DarkModeProvider')
  }
  return context
}
// // contexts/DarkModeContext.tsx
// 'use client'

// import React, { createContext, useContext, useEffect, useState } from 'react'

// interface DarkModeContextType {
//   isDark: boolean
//   toggle: () => void
//   setDark: (dark: boolean) => void
// }

// const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined)

// export function DarkModeProvider({ children }: { children: React.ReactNode }) {
//   const [isDark, setIsDark] = useState(false)
//   const [mounted, setMounted] = useState(false)

//   useEffect(() => {
//     setMounted(true)
    
//     // Check localStorage first, then system preference
//     const stored = localStorage.getItem('darkMode')
//     if (stored !== null) {
//       setIsDark(stored === 'true')
//     } else {
//       // Check system preference
//       const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
//       setIsDark(systemDark)
//     }
//   }, [])

//   useEffect(() => {
//     if (!mounted) return
    
//     // Update document class and localStorage
//     document.documentElement.classList.toggle('dark', isDark)
//     localStorage.setItem('darkMode', isDark.toString())
//   }, [isDark, mounted])

//   const toggle = () => setIsDark(prev => !prev)
//   const setDark = (dark: boolean) => setIsDark(dark)

//   // Prevent hydration mismatch by not rendering until mounted
//   if (!mounted) {
//     return <>{children}</>
//   }

//   return (
//     <DarkModeContext.Provider value={{ isDark, toggle, setDark }}>
//       {children}
//     </DarkModeContext.Provider>
//   )
// }

// export const useDarkMode = () => {
//   const context = useContext(DarkModeContext)
//   if (!context) {
//     throw new Error('useDarkMode must be used within DarkModeProvider')
//   }
//   return context
// }