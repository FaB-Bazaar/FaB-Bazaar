"use client"

interface FoilingBadgeProps {
  foiling: string
  size?: 'sm' | 'md' | 'lg'
}

export function FoilingBadge({ foiling, size = 'sm' }: FoilingBadgeProps) {
  const foilingUpper = foiling?.toUpperCase()

  // Standard/Non-foil doesn't need a badge
  if (!foiling || foiling === 'S' || foiling === 'N') {
    return null
  }

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-3 py-1.5'
  }

  // Rainbow Foil - animated rainbow gradient
  if (foiling === 'R') {
    return (
      <div className={`${sizeClasses[size]} rounded font-bold text-white shadow-md relative overflow-hidden`}>
        <div
          className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 via-indigo-500 to-purple-500 animate-rainbow-slide"
          style={{ backgroundSize: '200% 200%' }}
        />
        <span className="relative z-10">Rainbow</span>
      </div>
    )
  }

  // Cold Foil - animated silver/blue shimmer
  if (foiling === 'C') {
    return (
      <div className={`${sizeClasses[size]} rounded font-bold text-white shadow-md relative overflow-hidden`}>
        <div
          className="absolute inset-0 bg-gradient-to-r from-slate-300 via-blue-200 via-slate-400 to-slate-300 animate-shimmer"
          style={{ backgroundSize: '200% 200%' }}
        />
        <span className="relative z-10 text-slate-800">Cold Foil</span>
      </div>
    )
  }

  // Gold Foil - animated gold shimmer
  if (foiling === 'G') {
    return (
      <div className={`${sizeClasses[size]} rounded font-bold text-white shadow-md relative overflow-hidden`}>
        <div
          className="absolute inset-0 bg-gradient-to-r from-yellow-600 via-yellow-300 via-yellow-500 to-yellow-600 animate-shimmer"
          style={{ backgroundSize: '200% 200%' }}
        />
        <span className="relative z-10 text-yellow-900">Gold Foil</span>
      </div>
    )
  }

  // Marvel - animated purple/pink
  if (foiling === 'M') {
    return (
      <div className={`${sizeClasses[size]} rounded font-bold text-white shadow-md relative overflow-hidden`}>
        <div
          className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 animate-shimmer"
          style={{ backgroundSize: '200% 200%' }}
        />
        <span className="relative z-10">Marvel</span>
      </div>
    )
  }

  // Fallback for unknown foiling types
  return (
    <div className={`${sizeClasses[size]} rounded font-semibold bg-gray-500 text-white`}>
      {foiling}
    </div>
  )
}
