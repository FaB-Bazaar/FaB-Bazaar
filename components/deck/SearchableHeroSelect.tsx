// components/deck/SearchableHeroSelect.tsx
"use client";

import React, { useState, useMemo } from "react";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { HERO_INFO, YOUNG_HERO_INFO, type HeroInfo } from '@/lib/fab-constants';

const toDisplayName = (name: string) => name.replace(/\b\w/g, c => c.toUpperCase());

interface SearchableHeroSelectProps {
  heroes: Record<string, string[]>; // Grouped by class
  format: string;
  onSelect: (heroName: string) => void;
  value?: string;
  showGeneric?: boolean; // Adds a "Generic — all heroes" option at the top
}

export function SearchableHeroSelect({
  heroes,
  format,
  onSelect,
  value,
  showGeneric = false,
}: SearchableHeroSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Flatten heroes list with their class and talent info
  const flatHeroes = useMemo(() => {
    const result: Array<{
      name: string;
      class: string;
      talents: string[];
    }> = [];

    Object.entries(heroes).forEach(([className, heroNames]) => {
      heroNames.forEach((heroName) => {
        // Get hero info from appropriate source based on format
        const heroInfo = format === 'Silver Age'
          ? YOUNG_HERO_INFO[heroName.toLowerCase() as keyof typeof YOUNG_HERO_INFO]
          : HERO_INFO[heroName.toLowerCase() as keyof typeof HERO_INFO];

        result.push({
          name: heroName,
          class: className,
          talents: heroInfo?.talents || []
        });
      });
    });

    return result;
  }, [heroes, format]);

  // Filter heroes by search query
  const filteredHeroes = useMemo(() => {
    if (!search.trim()) return flatHeroes;

    const searchLower = search.toLowerCase();
    return flatHeroes.filter(hero =>
      hero.name.toLowerCase().includes(searchLower) ||
      hero.class.toLowerCase().includes(searchLower) ||
      hero.talents.some(t => t.toLowerCase().includes(searchLower))
    );
  }, [search, flatHeroes]);

  // Group filtered results by class
  const groupedFiltered = useMemo(() => {
    const grouped: Record<string, typeof flatHeroes> = {};

    filteredHeroes.forEach(hero => {
      if (!grouped[hero.class]) {
        grouped[hero.class] = [];
      }
      grouped[hero.class].push(hero);
    });

    // Sort classes alphabetically
    const sorted: Record<string, typeof flatHeroes> = {};
    Object.keys(grouped)
      .sort()
      .forEach(className => {
        sorted[className] = grouped[className].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      });

    return sorted;
  }, [filteredHeroes]);

  const handleSelect = (heroName: string) => {
    onSelect(heroName);
    setOpen(false);
    setSearch("");
  };

  const selectedHero = flatHeroes.find(h => h.name === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {showGeneric && !value ? (
            <span className="text-foreground">Generic — all heroes</span>
          ) : selectedHero ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="truncate">{toDisplayName(selectedHero.name)}</span>
              {selectedHero.talents.length > 0 && (
                <div className="flex gap-1 shrink-0">
                  {selectedHero.talents.map((talent: string) => (
                    <Badge key={talent} variant="secondary" className="text-[10px] py-0 px-1.5">
                      {talent}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">Search for a hero...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search heroes by name, class, or talent..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>No heroes found.</CommandEmpty>
            {showGeneric && (
              <CommandGroup>
                <CommandItem value="__generic__" onSelect={() => handleSelect('')}>
                  <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                  <span className="text-muted-foreground italic">Generic — applies to all heroes</span>
                </CommandItem>
              </CommandGroup>
            )}
            {Object.entries(groupedFiltered).map(([className, classHeroes]) => (
              <CommandGroup key={className} heading={className}>
                {classHeroes.map((hero) => (
                  <CommandItem
                    key={hero.name}
                    value={hero.name}
                    onSelect={() => handleSelect(hero.name)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === hero.name ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="truncate">{toDisplayName(hero.name)}</span>
                      {hero.talents.length > 0 && (
                        <div className="flex gap-1 shrink-0">
                          {hero.talents.map((talent: string) => (
                            <Badge key={talent} variant="secondary" className="text-[10px] py-0 px-1.5">
                              {talent}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
