// components/DarkModeToggle.tsx
'use client'

import { Moon, Sun } from 'lucide-react'
import { useDarkMode } from '@/contexts/DarkModeContext'

export function DarkModeToggle() {
  try {
    const { isDark, toggle, mounted } = useDarkMode()

    // Don't render the actual icon until mounted to prevent hydration mismatch
    if (!mounted) {
      return (
        <button
          disabled
          className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700"
          aria-label="Loading theme toggle"
        >
          <div className="w-5 h-5" /> {/* Empty placeholder */}
        </button>
      )
    }

    return (
      <button
        onClick={toggle}
        className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700"
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      >
        {isDark ? (
          <Sun className="w-5 h-5 text-yellow-500" />
        ) : (
          <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        )}
      </button>
    )
  } catch (error) {
    console.error('DarkModeToggle error:', error)
    return (
      <button
        disabled
        className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 opacity-50"
      >
        <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
      </button>
    )
  }
}
// // components/DarkModeToggle.tsx
// 'use client'

// import { Moon, Sun } from 'lucide-react'
// import { useDarkMode } from '@/contexts/DarkModeContext'

// export function DarkModeToggle() {
//   try {
//     const { isDark, toggle } = useDarkMode()

//     return (
//       <button
//         onClick={toggle}
//         className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700"
//         aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
//         title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
//       >
//         {isDark ? (
//           <Sun className="w-5 h-5 text-yellow-500" />
//         ) : (
//           <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
//         )}
//       </button>
//     )
//   } catch (error) {
//     console.error('DarkModeToggle error:', error)
//     // Fallback UI
//     return (
//       <button
//         disabled
//         className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 opacity-50"
//       >
//         <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
//       </button>
//     )
//   }
// }