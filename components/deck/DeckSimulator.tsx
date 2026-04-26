// components/deck/DeckSimulator.tsx
"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shuffle, RotateCcw, ArrowRight } from "lucide-react";
import Image from "next/image";

interface DeckPrinting {
  _id?: string;
  printingId: string;
  printingDetails?: { [key: string]: any };
}

interface DeckSimulatorProps {
  deck: {
    hero: DeckPrinting[];
    equipment: DeckPrinting[];
    maindeck: DeckPrinting[];
    inventory: DeckPrinting[];
  };
}

type CardAction = "unused" | "attack" | "block" | "arsenal";

interface HandCard {
  printing: DeckPrinting;
  action: CardAction;
}

const MIN_INCOMING = 5;
const MAX_INCOMING = 14;
const rollIncoming = () =>
  Math.floor(Math.random() * (MAX_INCOMING - MIN_INCOMING + 1)) + MIN_INCOMING;

const getCardStats = (printing: DeckPrinting) => {
  const details = printing.printingDetails || {};
  return {
    name: details.display_name || details.name || "Unknown",
    attack: Number(details.power) || 0,
    defense: Number(details.defense) || 0,
    pitch: Number(details.pitch) || 0,
    image: details.image_url || details.image_uris?.front || "/placeholder-card.png",
  };
};

interface LineResult {
  attack: number;
  blockRaw: number;
  blocked: number;
  taken: number;
  total: number;
}

// Brute-force the highest-value attack/block partition. Hand size ≤ ~7, so
// 2^n is trivial. Arsenal-tagged cards are held out and don't participate.
function computeBestLine(hand: HandCard[], incoming: number): LineResult {
  const playable = hand.filter((c) => c.action !== "arsenal");
  const n = playable.length;

  let best: LineResult = {
    attack: 0,
    blockRaw: 0,
    blocked: 0,
    taken: incoming,
    total: -Infinity,
  };

  for (let mask = 0; mask < 1 << n; mask++) {
    let atk = 0;
    let blk = 0;
    for (let bit = 0; bit < n; bit++) {
      const stats = getCardStats(playable[bit].printing);
      if (mask & (1 << bit)) {
        blk += stats.defense;
      } else {
        atk += stats.attack;
      }
    }
    const blocked = Math.min(blk, incoming);
    const total = atk + blocked;
    if (total > best.total) {
      best = { attack: atk, blockRaw: blk, blocked, taken: incoming - blocked, total };
    }
  }
  return best;
}

export default function DeckSimulator({ deck }: DeckSimulatorProps) {
  const [hand, setHand] = useState<HandCard[]>([]);
  const [arsenal, setArsenal] = useState<DeckPrinting | null>(null);
  const [deckCards, setDeckCards] = useState<DeckPrinting[]>([]);
  const [graveyard, setGraveyard] = useState<DeckPrinting[]>([]);
  const [incomingAttack, setIncomingAttack] = useState(0);
  const [turnNumber, setTurnNumber] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);

  const initializeDeck = () => {
    const shuffledDeck = [...deck.maindeck].sort(() => Math.random() - 0.5);
    setDeckCards(shuffledDeck);
    setHand([]);
    setArsenal(null);
    setGraveyard([]);
    setIncomingAttack(0);
    setTurnNumber(0);
    setGameStarted(true);
  };

  const drawCards = (count: number) => {
    const drawn = deckCards.slice(0, count);
    const remaining = deckCards.slice(count);

    setHand(drawn.map((printing) => ({ printing, action: "unused" as CardAction })));
    setDeckCards(remaining);
    setIncomingAttack(rollIncoming());
    setTurnNumber((prev) => prev + 1);
  };

  const startGame = () => {
    initializeDeck();
  };

  React.useEffect(() => {
    if (gameStarted && hand.length === 0 && deckCards.length > 0) {
      drawCards(Math.min(4, deckCards.length));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStarted, hand.length, deckCards.length]);

  const setCardAction = (index: number, action: CardAction) => {
    setHand((prev) =>
      prev.map((card, i) => (i === index ? { ...card, action } : card))
    );
  };

  const yourLine = useMemo<LineResult>(() => {
    let atk = 0;
    let blk = 0;
    const assignments: CardAction[] = [];
    hand.forEach(({ printing, action }) => {
      const stats = getCardStats(printing);
      assignments.push(action);
      if (action === "attack") atk += stats.attack;
      else if (action === "block") blk += stats.defense;
    });
    const blocked = Math.min(blk, incomingAttack);
    return {
      attack: atk,
      blockRaw: blk,
      blocked,
      taken: incomingAttack - blocked,
      total: atk + blocked,
      assignments,
    };
  }, [hand, incomingAttack]);

  const bestLine = useMemo(
    () => computeBestLine(hand, incomingAttack),
    [hand, incomingAttack]
  );

  const delta = yourLine.total - bestLine.total;
  const anyChosen = hand.some((c) => c.action === "attack" || c.action === "block");

  const endTurn = () => {
    const toGraveyard = hand.filter((c) => c.action !== "arsenal").map((c) => c.printing);
    const toArsenal = hand.find((c) => c.action === "arsenal");

    setGraveyard((prev) => [...prev, ...toGraveyard]);
    if (toArsenal) {
      setArsenal(toArsenal.printing);
    }
    setHand([]);
  };

  const resetGame = () => {
    setGameStarted(false);
    setHand([]);
    setDeckCards([]);
    setGraveyard([]);
    setArsenal(null);
    setIncomingAttack(0);
    setTurnNumber(0);
  };

  if (!gameStarted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <h2 className="text-2xl font-bold">Deck Simulator</h2>
        <p className="text-gray-600 dark:text-gray-300 text-center max-w-md">
          Practice the value-counting math. Each turn you face a random incoming attack
          (between {MIN_INCOMING} and {MAX_INCOMING}). Pick attack or block for each card,
          and the coach shows the highest-value line so you can see how your choice compares.
        </p>
        <Button onClick={startGame} size="lg">
          <Shuffle className="mr-2 h-5 w-5" />
          Start Simulation
        </Button>
      </div>
    );
  }

  const deltaTone =
    delta >= 0
      ? "text-green-600"
      : delta >= -2
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-red-600";
  const deltaIcon = delta >= 0 ? "🎯" : delta >= -2 ? "⚖️" : "⚠️";

  return (
    <div className="space-y-4">
      {/* Coach panel */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-500 rounded-lg p-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Incoming attack:
              </span>
              <span className="text-lg font-bold text-red-600">{incomingAttack}</span>
            </div>
            <div className="h-5 w-px bg-gray-300 dark:bg-gray-600" />
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-700 dark:text-gray-200 font-semibold">Your line:</span>
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
            </div>
            <div className="h-5 w-px bg-gray-300 dark:bg-gray-600" />
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-700 dark:text-gray-200 font-semibold">Best line:</span>
              <span>
                <span className="text-red-600 font-bold">{bestLine.attack}</span>
                <span className="text-gray-500 dark:text-gray-300"> atk</span>
                {" + "}
                <span className="text-blue-600 dark:text-blue-300 font-bold">
                  {bestLine.blocked}
                </span>
                <span className="text-gray-500 dark:text-gray-300"> blocked</span>
                {" = "}
                <span className="font-bold">{bestLine.total}</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 dark:text-gray-300">Δ vs best:</span>
            <div className={`text-lg font-bold ${anyChosen ? deltaTone : "text-gray-400"}`}>
              {anyChosen ? (delta >= 0 ? `+${delta}` : delta) : "—"}
            </div>
            {anyChosen && <span className="text-xs">{deltaIcon}</span>}
          </div>
        </div>
      </div>

      {/* Hand */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">
            Hand ({hand.length} cards) · Turn {turnNumber}
          </h3>
          <div className="flex gap-2">
            <Button onClick={endTurn} variant="outline" disabled={hand.length === 0}>
              End Turn <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button onClick={resetGame} variant="outline" size="sm">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {hand.map((handCard, index) => {
            const stats = getCardStats(handCard.printing);
            const actionLabel: Record<CardAction, string> = {
              unused: "",
              attack: "ATK",
              block: "BLK",
              arsenal: "ARS",
            };
            return (
              <div key={index} className="space-y-2 max-w-[160px]">
                <div
                  className={`relative rounded-lg overflow-hidden border-2 ${
                    handCard.action === "attack"
                      ? "border-red-500"
                      : handCard.action === "block"
                      ? "border-blue-500"
                      : handCard.action === "arsenal"
                      ? "border-purple-500"
                      : "border-gray-300 dark:border-gray-600"
                  }`}
                >
                  {handCard.action !== "unused" && (
                    <div className="absolute top-1 left-1 z-10 bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                      {actionLabel[handCard.action]}
                    </div>
                  )}
                  <Image
                    src={stats.image}
                    alt={stats.name}
                    width={160}
                    height={224}
                    className="w-full h-auto"
                    unoptimized
                  />
                </div>

                <div className="text-xs space-y-1">
                  <div className="font-semibold truncate" title={stats.name}>
                    {stats.name}
                  </div>
                  <div className="flex gap-1">
                    <Badge variant="outline">⚔️ {stats.attack}</Badge>
                    <Badge variant="outline">🛡️ {stats.defense}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1">
                  <Button
                    size="sm"
                    variant={handCard.action === "attack" ? "default" : "outline"}
                    onClick={() =>
                      setCardAction(
                        index,
                        handCard.action === "attack" ? "unused" : "attack"
                      )
                    }
                    className="text-xs"
                  >
                    Attack
                  </Button>
                  <Button
                    size="sm"
                    variant={handCard.action === "block" ? "default" : "outline"}
                    onClick={() =>
                      setCardAction(
                        index,
                        handCard.action === "block" ? "unused" : "block"
                      )
                    }
                    className="text-xs"
                  >
                    Block
                  </Button>
                  <Button
                    size="sm"
                    variant={handCard.action === "arsenal" ? "default" : "outline"}
                    onClick={() =>
                      setCardAction(
                        index,
                        handCard.action === "arsenal" ? "unused" : "arsenal"
                      )
                    }
                    className="text-xs col-span-2"
                  >
                    Arsenal
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {hand.length === 0 && deckCards.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-300">
            Deck exhausted. Click Reset to start a new game.
          </div>
        )}
      </div>
    </div>
  );
}
