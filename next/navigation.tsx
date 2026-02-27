// next/navigation.tsx
// Bare minimum implementation to satisfy the useRouter import.

const useRouter = () => {
  return {
    push: (url: string) => {
      window.location.href = url
    },
    back: () => {
      window.history.back()
    },
    prefetch: async (url: string) => {
      //No prefetching implemented
    },
    replace: (url: string) => {
      window.location.replace(url)
    },
  }
}

export { useRouter }
