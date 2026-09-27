// components/FoilEffectsToggle.tsx
'use client'

import { Switch } from '@/components/ui/switch'
import { useFoilEffects } from '@/components/ui/use-client-env'

/** Switch for the "Card foil effects" preference (hover tilt/shine on foil cards). */
export function FoilEffectsToggle() {
  const [on, setOn] = useFoilEffects()
  return (
    <Switch
      checked={on}
      onCheckedChange={setOn}
      aria-label="Card foil effects"
      className="focus-visible:ring-blue-400"
    />
  )
}
