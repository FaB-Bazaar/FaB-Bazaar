// app/training/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, RotateCcw, ChevronRight, Target, BookOpen } from "lucide-react";

import { PUZZLES, type Puzzle, type PuzzleAction, type PuzzleLine } from "@/lib/training/puzzles";

const ACTION_LABEL: Record<Exclude<PuzzleAction, "unused">, string> = {
  attack: "ATK",
  block: "BLK",
  pitch: "PCH",
};

const ACTION_BORDER: Record<PuzzleAction, string> = {
  unused: "border-gray-300 dark:border-gray-600",
  attack: "border-red-500",
  block: "border-blue-500",
  pitch: "border-yellow-500",
};

type WeaponState = "idle" | "attack";
type ReturnedAction = "attack" | "pitch";

function returnedCardOf(puzzle: Puzzle) {
  if (!puzzle.heroAbility?.consumesGraveyardCard) return undefined;
  return puzzle.graveyard?.[0];
}

function countDraconicChainLinks(
  puzzle: Puzzle,
  actions: Record<string, PuzzleAction>,
  weaponStates: Record<string, WeaponState>,
  abilityActive: boolean,
  returnedAction: ReturnedAction,
  subtype: string
) {
  let n = 0;
  for (const card of puzzle.hand) {
    if (actions[card.id] === "attack" && card.subtypes?.includes(subtype)) n++;
  }
  for (const w of puzzle.weapons ?? []) {
    if (weaponStates[w.id] === "attack" && w.subtypes?.includes(subtype)) n++;
  }
  const returned = returnedCardOf(puzzle);
  if (
    abilityActive &&
    returned &&
    returnedAction === "attack" &&
    returned.subtypes?.includes(subtype)
  ) {
    n++;
  }
  return n;
}

function abilityCost(puzzle: Puzzle, chainLinks: number) {
  const a = puzzle.heroAbility;
  if (!a) return 0;
  return Math.max(0, a.baseCost - chainLinks);
}

function computeYourLine(
  puzzle: Puzzle,
  actions: Record<string, PuzzleAction>,
  weaponStates: Record<string, WeaponState>,
  abilityActive: boolean,
  returnedAction: ReturnedAction
) {
  let attack = 0;
  let blockRaw = 0;
  let resourcesPitched = 0;
  let resourcesNeeded = 0;
  for (const card of puzzle.hand) {
    const a = actions[card.id] ?? "unused";
    if (a === "attack") {
      attack += card.power;
      resourcesNeeded += card.cost;
    } else if (a === "block") {
      blockRaw += card.defense;
    } else if (a === "pitch") {
      resourcesPitched += card.pitch;
    }
  }
  for (const w of puzzle.weapons ?? []) {
    if (weaponStates[w.id] === "attack") {
      attack += w.power;
      resourcesNeeded += w.cost;
    }
  }
  const subtype = puzzle.heroAbility?.costReductionSubtype;
  const chainLinks = subtype
    ? countDraconicChainLinks(
        puzzle,
        actions,
        weaponStates,
        abilityActive,
        returnedAction,
        subtype
      )
    : 0;
  const liveAbilityCost = abilityCost(puzzle, chainLinks);
  const returned = returnedCardOf(puzzle);
  if (abilityActive && puzzle.heroAbility) {
    resourcesNeeded += liveAbilityCost;
    if (returned) {
      if (returnedAction === "attack") {
        attack += returned.power;
        resourcesNeeded += returned.cost;
      } else {
        resourcesPitched += returned.pitch;
      }
    }
  }
  const incoming = puzzle.incomingAttack.value;
  const blocked = Math.min(blockRaw, incoming);
  return {
    attack,
    blockRaw,
    blocked,
    resourcesPitched,
    resourcesNeeded,
    chainLinks,
    liveAbilityCost,
    taken: incoming - blocked,
    total: attack + blocked,
    playable: resourcesNeeded <= resourcesPitched,
  };
}

function findClosestLine(puzzle: Puzzle, yourTotal: number): PuzzleLine | undefined {
  let best: PuzzleLine | undefined;
  let bestDiff = Infinity;
  for (const line of puzzle.lines) {
    const diff = Math.abs(line.total - yourTotal);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = line;
    }
  }
  return best;
}

export default function TrainingPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activePuzzle = activeId ? PUZZLES.find((p) => p.id === activeId) : null;

  if (!activePuzzle) {
    return <PuzzleIndex onSelect={setActiveId} />;
  }
  return (
    <PuzzleSolver
      key={activePuzzle.id}
      puzzle={activePuzzle}
      onBack={() => setActiveId(null)}
    />
  );
}

function PuzzleIndex({ onSelect }: { onSelect: (id: string) => void }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Target className="h-7 w-7" />
            Value Training
          </h1>
          <p className="text-gray-600 dark:text-gray-300 max-w-2xl">
            Curated Flesh and Blood scenarios from the value framework. Each puzzle
            presents a hand and asks you to find the highest-value line. Submit your
            answer to compare against the optimal play and read the lesson.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PUZZLES.map((puzzle) => (
            <Card
              key={puzzle.id}
              className="hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">{puzzle.title}</CardTitle>
                  <Badge variant="secondary" className="shrink-0">
                    {puzzle.lessonTag}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                  {puzzle.scenario}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-300">
                    <span>{puzzle.hand.length} cards</span>
                    <span>·</span>
                    <span>Incoming: {puzzle.incomingAttack.value}</span>
                  </div>
                  <Button size="sm" onClick={() => onSelect(puzzle.id)}>
                    Try puzzle <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-xs text-gray-500 dark:text-gray-300">
          More puzzles will be added. Lessons sourced from articles by Michael
          Hamilton, Vazerum, and the Arsenal Pass podcast.
        </div>
      </div>
    </div>
  );
}

function PuzzleSolver({ puzzle, onBack }: { puzzle: Puzzle; onBack: () => void }) {
  const [actions, setActions] = useState<Record<string, PuzzleAction>>({});
  const [weaponStates, setWeaponStates] = useState<Record<string, WeaponState>>({});
  const [abilityActive, setAbilityActive] = useState(false);
  const [returnedAction, setReturnedAction] = useState<ReturnedAction>("pitch");
  const [submitted, setSubmitted] = useState(false);

  const returnedCard = returnedCardOf(puzzle);

  const yourLine = useMemo(
    () => computeYourLine(puzzle, actions, weaponStates, abilityActive, returnedAction),
    [puzzle, actions, weaponStates, abilityActive, returnedAction]
  );
  const optimalLine = puzzle.lines.find((l) => l.id === puzzle.optimalLineId);
  const closestLine = useMemo(
    () => (submitted ? findClosestLine(puzzle, yourLine.total) : undefined),
    [submitted, puzzle, yourLine.total]
  );

  const setAction = (cardId: string, action: PuzzleAction) => {
    setActions((prev) => ({
      ...prev,
      [cardId]: prev[cardId] === action ? "unused" : action,
    }));
  };

  const toggleWeapon = (weaponId: string) => {
    setWeaponStates((prev) => ({
      ...prev,
      [weaponId]: prev[weaponId] === "attack" ? "idle" : "attack",
    }));
  };

  const reset = () => {
    setActions({});
    setWeaponStates({});
    setAbilityActive(false);
    setReturnedAction("pitch");
    setSubmitted(false);
  };

  const anyChosen =
    puzzle.hand.some((c) => (actions[c.id] ?? "unused") !== "unused") ||
    Object.values(weaponStates).some((s) => s === "attack") ||
    abilityActive;
  const optimalDelta = optimalLine ? yourLine.total - optimalLine.total : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> All puzzles
          </Button>
          <h1 className="text-xl font-bold">{puzzle.title}</h1>
          <Badge variant="secondary">{puzzle.lessonTag}</Badge>
        </div>

        {/* Scenario */}
        <Card className="mb-4">
          <CardContent className="pt-6 space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-200">
              {puzzle.scenario}
            </p>
            {puzzle.hero.abilityNote && (
              <p className="text-xs text-gray-500 dark:text-gray-300 italic">
                {puzzle.hero.abilityNote}
              </p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="destructive" className="text-sm">
                Incoming: {puzzle.incomingAttack.value}
              </Badge>
              <span className="text-xs text-gray-600 dark:text-gray-300">
                {puzzle.incomingAttack.description}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Live tally */}
        <div className="bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-500 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 text-sm">
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                Your line:
              </span>
              <span>
                <span className="text-red-600 font-bold">{yourLine.attack}</span>
                <span className="text-gray-500 dark:text-gray-300"> atk</span>
                {" + "}
                <span className="text-blue-600 dark:text-blue-300 font-bold">
                  {yourLine.blocked}
                </span>
                <span className="text-gray-500 dark:text-gray-300"> blocked</span>
                {yourLine.blockRaw > yourLine.blocked && (
                  <span className="text-gray-400 dark:text-gray-300 ml-1">
                    ({yourLine.blockRaw - yourLine.blocked} wasted)
                  </span>
                )}
                {" = "}
                <span className="font-bold">{yourLine.total}</span>
              </span>
              {yourLine.taken > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-300">
                  (take {yourLine.taken})
                </span>
              )}
              {(() => {
                const pool = yourLine.resourcesPitched - yourLine.resourcesNeeded;
                return (
                  <span
                    className={`text-xs ${
                      pool < 0
                        ? "text-red-600 dark:text-red-400 font-semibold"
                        : "text-yellow-700 dark:text-yellow-400"
                    }`}
                  >
                    · resources: +{yourLine.resourcesPitched} pitched − {yourLine.resourcesNeeded} spent ={" "}
                    <span className="font-bold">
                      {pool >= 0 ? `+${pool}` : pool}
                    </span>{" "}
                    pool
                    {pool < 0 && " ⚠ insufficient"}
                  </span>
                );
              })()}
              {puzzle.heroAbility?.costReductionSubtype && (
                <span className="text-xs text-purple-700 dark:text-purple-300">
                  · {yourLine.chainLinks} {puzzle.heroAbility.costReductionSubtype}{" "}
                  chain link{yourLine.chainLinks === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {!submitted ? (
                <Button
                  size="sm"
                  onClick={() => setSubmitted(true)}
                  disabled={!anyChosen}
                >
                  Submit answer
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={reset}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Try again
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Playmat zones */}
        <div className="bg-gray-100 dark:bg-gray-800/50 border border-gray-300 dark:border-gray-700 rounded-lg p-3 mb-4">
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-4 items-start">
            {/* Hero + Ability zone */}
            <div className="space-y-2 w-32">
              <div className="text-[10px] uppercase font-semibold text-gray-500 dark:text-gray-300">
                Hero
              </div>
              {puzzle.hero.imageUrl && (
                <Image
                  src={puzzle.hero.imageUrl}
                  alt={puzzle.hero.name}
                  width={128}
                  height={180}
                  className="w-full h-auto rounded-md"
                  unoptimized
                />
              )}
              <div className="text-xs text-center font-semibold">
                {puzzle.hero.name}
              </div>
              {puzzle.heroAbility && (
                <div className="space-y-1">
                  <Button
                    size="sm"
                    variant={abilityActive ? "default" : "outline"}
                    onClick={() => setAbilityActive((v) => !v)}
                    disabled={submitted}
                    className="w-full text-xs"
                  >
                    {abilityActive ? "Active" : "Activate"} (cost{" "}
                    {yourLine.liveAbilityCost})
                  </Button>
                  <div
                    className="text-[10px] text-gray-500 dark:text-gray-300 text-center"
                    title={puzzle.heroAbility.description}
                  >
                    {puzzle.heroAbility.name}
                  </div>
                </div>
              )}
            </div>

            {/* Weapons zone */}
            <div className="space-y-2">
              <div className="text-[10px] uppercase font-semibold text-gray-500 dark:text-gray-300">
                Weapons
              </div>
              {puzzle.weapons && puzzle.weapons.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {puzzle.weapons.map((w) => {
                    const swung = (weaponStates[w.id] ?? "idle") === "attack";
                    return (
                      <div key={w.id} className="space-y-2 w-[120px]">
                        <div
                          className={`relative rounded-lg overflow-hidden border-2 ${
                            swung
                              ? "border-red-500"
                              : "border-gray-300 dark:border-gray-600"
                          }`}
                        >
                          {swung && (
                            <div className="absolute top-1 left-1 z-10 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                              ATK
                            </div>
                          )}
                          <Image
                            src={w.imageUrl}
                            alt={w.name}
                            width={120}
                            height={168}
                            className="w-full h-auto"
                            unoptimized
                          />
                        </div>
                        <div className="text-[10px] space-y-1">
                          <div className="font-semibold truncate" title={w.name}>
                            {w.name}
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            <Badge variant="secondary" className="text-[10px]">
                              ⚔️ {w.power}
                            </Badge>
                            {w.cost > 0 && (
                              <Badge variant="secondary" className="text-[10px]">
                                cost {w.cost}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={swung ? "default" : "outline"}
                          onClick={() => toggleWeapon(w.id)}
                          className="text-xs w-full"
                          disabled={submitted}
                        >
                          {swung ? "Attacking" : "Swing"}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-gray-400 dark:text-gray-500 italic">
                  None
                </div>
              )}
            </div>

            {/* Graveyard zone */}
            <div className="space-y-2 w-[140px]">
              <div className="text-[10px] uppercase font-semibold text-gray-500 dark:text-gray-300">
                Graveyard
                {abilityActive && returnedCard && (
                  <span className="ml-1 normal-case font-normal text-gray-400">
                    (1 returned)
                  </span>
                )}
              </div>
              {puzzle.graveyard && puzzle.graveyard.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {puzzle.graveyard.map((card, idx) => {
                    const consumed = abilityActive && idx === 0 && !!returnedCard;
                    return (
                      <div
                        key={`${card.id}-${idx}`}
                        className={`w-[60px] ${consumed ? "opacity-30" : ""}`}
                      >
                        <Image
                          src={card.imageUrl}
                          alt={card.name}
                          width={60}
                          height={84}
                          className="w-full h-auto rounded"
                          unoptimized
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-gray-400 dark:text-gray-500 italic">
                  Empty
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Hand */}
        <div className="text-[10px] uppercase font-semibold text-gray-500 dark:text-gray-300 mb-2">
          Hand
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
          {puzzle.hand.map((card) => {
            const action = actions[card.id] ?? "unused";
            return (
              <div key={card.id} className="space-y-2 max-w-[180px]">
                <div
                  className={`relative rounded-lg overflow-hidden border-2 ${ACTION_BORDER[action]}`}
                >
                  {action !== "unused" && (
                    <div className="absolute top-1 left-1 z-10 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                      {ACTION_LABEL[action]}
                    </div>
                  )}
                  <Image
                    src={card.imageUrl}
                    alt={card.name}
                    width={180}
                    height={252}
                    className="w-full h-auto"
                    unoptimized
                  />
                </div>
                <div className="text-xs space-y-1">
                  <div className="font-semibold truncate" title={card.name}>
                    {card.name}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    <Badge variant="secondary" className="text-[10px]">
                      ⚔️ {card.power}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      🛡️ {card.defense}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      💎 {card.pitch}
                    </Badge>
                    {card.cost > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        cost {card.cost}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <Button
                    size="sm"
                    variant={action === "attack" ? "default" : "outline"}
                    onClick={() => setAction(card.id, "attack")}
                    className="text-xs px-1"
                    disabled={submitted}
                  >
                    Atk
                  </Button>
                  <Button
                    size="sm"
                    variant={action === "block" ? "default" : "outline"}
                    onClick={() => setAction(card.id, "block")}
                    className="text-xs px-1"
                    disabled={submitted}
                  >
                    Blk
                  </Button>
                  <Button
                    size="sm"
                    variant={action === "pitch" ? "default" : "outline"}
                    onClick={() => setAction(card.id, "pitch")}
                    className="text-xs px-1"
                    disabled={submitted}
                  >
                    Pch
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Returned (graveyard card brought back via ability) */}
        {abilityActive && returnedCard && (
          <div className="mb-4">
            <div className="text-[10px] uppercase font-semibold text-purple-700 dark:text-purple-300 mb-2">
              Returned via {puzzle.heroAbility?.name}
            </div>
            <div className="flex">
              <div className="space-y-2 w-[140px]">
                <div
                  className={`relative rounded-lg overflow-hidden border-2 ${
                    returnedAction === "attack"
                      ? "border-red-500"
                      : "border-yellow-500"
                  }`}
                >
                  <div className="absolute top-1 left-1 z-10 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                    {returnedAction === "attack" ? "ATK" : "PCH"}
                  </div>
                  <Image
                    src={returnedCard.imageUrl}
                    alt={returnedCard.name}
                    width={140}
                    height={196}
                    className="w-full h-auto"
                    unoptimized
                  />
                </div>
                <div className="text-[10px] space-y-1">
                  <div className="font-semibold truncate" title={returnedCard.name}>
                    {returnedCard.name}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    <Badge variant="secondary" className="text-[10px]">
                      ⚔️ {returnedCard.power}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      💎 {returnedCard.pitch}
                    </Badge>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <Button
                    size="sm"
                    variant={returnedAction === "attack" ? "default" : "outline"}
                    onClick={() => setReturnedAction("attack")}
                    className="text-xs px-1"
                    disabled={submitted}
                  >
                    Atk
                  </Button>
                  <Button
                    size="sm"
                    variant={returnedAction === "pitch" ? "default" : "outline"}
                    onClick={() => setReturnedAction("pitch")}
                    className="text-xs px-1"
                    disabled={submitted}
                  >
                    Pch
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reveal */}
        {submitted && (
          <Card className="border-2 border-green-500/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5" />
                Lines compared
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {puzzle.lines.map((line) => {
                  const isOptimal = line.id === puzzle.optimalLineId;
                  const isClosest = line.id === closestLine?.id;
                  return (
                    <div
                      key={line.id}
                      className={`p-3 rounded-lg border-2 ${
                        isOptimal
                          ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                          : isClosest
                          ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20"
                          : "border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{line.label}</span>
                          {isOptimal && (
                            <Badge className="bg-green-600 hover:bg-green-700 text-white">
                              Optimal
                            </Badge>
                          )}
                          {isClosest && !isOptimal && (
                            <Badge variant="secondary">Closest to your line</Badge>
                          )}
                        </div>
                        <div className="text-lg font-bold shrink-0">{line.total}</div>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-200">
                        {line.description}
                      </p>
                      <div className="text-xs text-gray-500 dark:text-gray-300 mt-1">
                        {line.breakdown}
                      </div>
                    </div>
                  );
                })}
              </div>

              {optimalLine && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">Your raw line:</span>
                  <span className="font-bold">{yourLine.total}</span>
                  <span className="text-gray-500 dark:text-gray-300">
                    vs optimal {optimalLine.total}
                  </span>
                  <Badge
                    className={
                      optimalDelta >= 0
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : optimalDelta >= -2
                        ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                        : "bg-red-600 hover:bg-red-700 text-white"
                    }
                  >
                    {optimalDelta >= 0 ? `+${optimalDelta}` : optimalDelta}
                  </Badge>
                  <span className="text-xs text-gray-500 dark:text-gray-300">
                    (raw line ignores weapon and hero contributions baked into the
                    listed lines)
                  </span>
                </div>
              )}

              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <div className="text-sm font-semibold mb-1">Lesson</div>
                <p className="text-sm text-gray-700 dark:text-gray-200">
                  {puzzle.lesson}
                </p>
                <div className="text-xs text-gray-500 dark:text-gray-300 mt-2 italic">
                  Source: {puzzle.source}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={reset}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Try again
                </Button>
                <Button variant="outline" onClick={onBack}>
                  Back to puzzles
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
