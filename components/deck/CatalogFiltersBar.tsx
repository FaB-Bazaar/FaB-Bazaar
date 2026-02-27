"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { RarityIcon } from "@/components/shared/RarityIcon"
import { Search, SlidersHorizontal, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface CatalogFiltersBarProps {
  filters: {
    searchQuery: string
    pitchValues: string[]
    types: string[]
    rarities: string[]
    foilings?: string[]
    costs?: number[]
    powerMin?: number
    powerMax?: number
    defenseMin?: number
    defenseMax?: number
    classes?: string[]
    talents?: string[]
  }
  onFilterChange: (filters: Partial<CatalogFiltersBarProps['filters']>) => void
  deckFormat?: string
}

const PITCH_VALUES = [
  { value: '1', label: 'Red', bgColor: 'bg-red-500' },
  { value: '2', label: 'Yellow', bgColor: 'bg-yellow-500' },
  { value: '3', label: 'Blue', bgColor: 'bg-blue-500' },
  { value: '0', label: 'No Pitch', bgColor: 'bg-gray-400' },
]

const CARD_TYPES = [
  'action', 'attack', 'attack reaction', 'defense reaction',
  'instant', 'equipment', 'weapon', 'item', 'aura'
]

const RARITIES = [
  { value: 'F', label: 'Fabled' },
  { value: 'L', label: 'Legendary' },
  { value: 'M', label: 'Majestic' },
  { value: 'S', label: 'Super Rare' },
  { value: 'R', label: 'Rare' },
  { value: 'C', label: 'Common' },
  { value: 'T', label: 'Token' },
  { value: 'P', label: 'Promo' },
  { value: 'V', label: 'Marvel' },
]

const FOILINGS = [
  { value: 'S', label: 'Standard' },
  { value: 'R', label: 'Rainbow Foil' },
  { value: 'C', label: 'Cold Foil' },
  { value: 'G', label: 'Gold Cold Foil' },
]

const CLASSES = [
  'Assassin', 'Brute', 'Guardian', 'Illusionist', 'Mechanologist',
  'Necromancer', 'Ninja', 'Ranger', 'Runeblade', 'Warrior', 'Wizard'
]

const TALENTS = [
  'Chaos', 'Draconic', 'Elemental', 'Light', 'Mystic', 'Pirate', 'Royal', 'Shadow'
]

const COSTS = [0, 1, 2, 3, 4, 5, 6]

export default function CatalogFiltersBar({
  filters,
  onFilterChange,
  deckFormat
}: CatalogFiltersBarProps) {
  const [typeOpen, setTypeOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const isSilverAge = deckFormat?.toLowerCase() === 'silver age'
  const excludedRarities = isSilverAge ? ['M', 'L', 'S', 'F'] : []

  const togglePitch = (v: string) => {
    const next = filters.pitchValues.includes(v)
      ? filters.pitchValues.filter(p => p !== v)
      : [...filters.pitchValues, v]
    onFilterChange({ pitchValues: next })
  }

  const toggleType = (v: string) => {
    const next = filters.types.includes(v)
      ? filters.types.filter(t => t !== v)
      : [...filters.types, v]
    onFilterChange({ types: next })
  }

  const toggleRarity = (v: string) => {
    const next = filters.rarities.includes(v)
      ? filters.rarities.filter(r => r !== v)
      : [...filters.rarities, v]
    onFilterChange({ rarities: next })
  }

  const toggleFoiling = (v: string) => {
    const cur = filters.foilings || []
    const next = cur.includes(v) ? cur.filter(f => f !== v) : [...cur, v]
    onFilterChange({ foilings: next })
  }

  const toggleClass = (v: string) => {
    const cur = filters.classes || []
    const next = cur.includes(v) ? cur.filter(c => c !== v) : [...cur, v]
    onFilterChange({ classes: next })
  }

  const toggleTalent = (v: string) => {
    const cur = filters.talents || []
    const next = cur.includes(v) ? cur.filter(t => t !== v) : [...cur, v]
    onFilterChange({ talents: next })
  }

  const toggleCost = (v: number) => {
    const cur = filters.costs || []
    const next = cur.includes(v) ? cur.filter(c => c !== v) : [...cur, v]
    onFilterChange({ costs: next })
  }

  const clearAll = () => {
    onFilterChange({
      searchQuery: '',
      pitchValues: ['1', '2', '3', '0'],
      types: [],
      rarities: [],
      foilings: [],
      costs: [],
      powerMin: undefined,
      powerMax: undefined,
      defenseMin: undefined,
      defenseMax: undefined,
      classes: [],
      talents: [],
    })
  }

  const moreCount = [
    ...(filters.foilings || []),
    ...(filters.classes || []),
    ...(filters.talents || []),
    filters.powerMin !== undefined ? [1] : [],
    filters.powerMax !== undefined ? [1] : [],
    filters.defenseMin !== undefined ? [1] : [],
    filters.defenseMax !== undefined ? [1] : [],
  ].flat().length

  const hasActiveFilters =
    !!filters.searchQuery ||
    filters.pitchValues.length < 4 ||
    filters.rarities.length > 0 ||
    (filters.costs || []).length > 0 ||
    filters.types.length > 0 ||
    moreCount > 0

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search cards..."
          value={filters.searchQuery}
          onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
          className="pl-7 h-8 text-xs w-36"
        />
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Pitch toggles */}
      <div className="flex items-center gap-1">
        {PITCH_VALUES.map(pitch => {
          const active = filters.pitchValues.includes(pitch.value)
          return (
            <button
              key={pitch.value}
              onClick={() => togglePitch(pitch.value)}
              title={pitch.label}
              className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all",
                active ? "border-foreground" : "border-transparent opacity-30 hover:opacity-60"
              )}
            >
              <div className={cn("w-4 h-4 rounded-full", pitch.bgColor)} />
            </button>
          )
        })}
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Cost toggles */}
      <div className="flex items-center gap-0.5">
        {COSTS.map(cost => {
          const active = (filters.costs || []).includes(cost)
          return (
            <button
              key={cost}
              onClick={() => toggleCost(cost)}
              title={`Cost ${cost}`}
              className={cn(
                "w-6 h-6 rounded text-xs font-medium transition-all",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {cost}
            </button>
          )
        })}
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Rarity toggles */}
      <div className="flex items-center gap-0.5">
        {RARITIES.map(rarity => {
          const active = filters.rarities.includes(rarity.value)
          const disabled = excludedRarities.includes(rarity.value)
          return (
            <button
              key={rarity.value}
              onClick={() => !disabled && toggleRarity(rarity.value)}
              title={disabled ? `${rarity.label} (not allowed in Silver Age)` : rarity.label}
              disabled={disabled}
              className={cn(
                "w-7 h-7 rounded flex items-center justify-center transition-all",
                active ? "bg-accent ring-1 ring-foreground/30" : "opacity-40 hover:opacity-80",
                disabled && "opacity-20 cursor-not-allowed hover:opacity-20"
              )}
            >
              <RarityIcon rarityCode={rarity.value} size="sm" />
            </button>
          )
        })}
      </div>

      <div className="w-px h-5 bg-border" />

      {/* Type dropdown */}
      <Popover open={typeOpen} onOpenChange={setTypeOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 text-xs",
              filters.types.length > 0 && "border-primary text-primary bg-primary/5"
            )}
          >
            Type
            {filters.types.length > 0 && (
              <span className="ml-1.5 bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                {filters.types.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-2" align="start">
          <div className="space-y-0.5">
            {CARD_TYPES.map(type => {
              const active = filters.types.includes(type)
              return (
                <div
                  key={type}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                  onClick={() => toggleType(type)}
                >
                  <Checkbox
                    checked={active}
                    onCheckedChange={() => toggleType(type)}
                    className="h-3.5 w-3.5"
                  />
                  <Label className="cursor-pointer text-xs capitalize">{type}</Label>
                </div>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* More filters */}
      <Popover open={moreOpen} onOpenChange={setMoreOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 text-xs gap-1.5",
              moreCount > 0 && "border-primary text-primary bg-primary/5"
            )}
          >
            <SlidersHorizontal className="h-3 w-3" />
            Filters
            {moreCount > 0 && (
              <span className="bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                {moreCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-3" align="start" side="bottom">
          <div className="space-y-4">
            {/* Foiling */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Foiling</p>
              <div className="grid grid-cols-2 gap-0.5">
                {FOILINGS.map(foiling => {
                  const active = (filters.foilings || []).includes(foiling.value)
                  return (
                    <div
                      key={foiling.value}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                      onClick={() => toggleFoiling(foiling.value)}
                    >
                      <Checkbox checked={active} onCheckedChange={() => toggleFoiling(foiling.value)} className="h-3.5 w-3.5" />
                      <Label className="cursor-pointer text-xs">{foiling.label}</Label>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Class */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Class</p>
              <div className="grid grid-cols-2 gap-0.5">
                {CLASSES.map(cls => {
                  const active = (filters.classes || []).includes(cls)
                  return (
                    <div
                      key={cls}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                      onClick={() => toggleClass(cls)}
                    >
                      <Checkbox checked={active} onCheckedChange={() => toggleClass(cls)} className="h-3.5 w-3.5" />
                      <Label className="cursor-pointer text-xs">{cls}</Label>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Talent */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Talent</p>
              <div className="grid grid-cols-2 gap-0.5">
                {TALENTS.map(talent => {
                  const active = (filters.talents || []).includes(talent)
                  return (
                    <div
                      key={talent}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                      onClick={() => toggleTalent(talent)}
                    >
                      <Checkbox checked={active} onCheckedChange={() => toggleTalent(talent)} className="h-3.5 w-3.5" />
                      <Label className="cursor-pointer text-xs">{talent}</Label>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Power */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Power</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.powerMin ?? ''}
                  onChange={(e) => onFilterChange({ powerMin: e.target.value ? Number(e.target.value) : undefined })}
                  className="h-7 text-xs"
                />
                <span className="text-xs text-muted-foreground">–</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.powerMax ?? ''}
                  onChange={(e) => onFilterChange({ powerMax: e.target.value ? Number(e.target.value) : undefined })}
                  className="h-7 text-xs"
                />
              </div>
            </div>

            {/* Defense */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Defense</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={filters.defenseMin ?? ''}
                  onChange={(e) => onFilterChange({ defenseMin: e.target.value ? Number(e.target.value) : undefined })}
                  className="h-7 text-xs"
                />
                <span className="text-xs text-muted-foreground">–</span>
                <Input
                  type="number"
                  placeholder="Max"
                  value={filters.defenseMax ?? ''}
                  onChange={(e) => onFilterChange({ defenseMax: e.target.value ? Number(e.target.value) : undefined })}
                  className="h-7 text-xs"
                />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear all */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
        >
          <X className="h-3 w-3" />
          Clear
        </Button>
      )}
    </div>
  )
}
