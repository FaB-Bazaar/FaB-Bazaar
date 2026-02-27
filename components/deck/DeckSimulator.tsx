// components/deck/DeckSimulator.tsx
"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type CardAction = "unused" | "attack" | "defend" | "pitch" | "arsenal" | "play";

interface HandCard {
  printing: DeckPrinting;
  action: CardAction;
}

export default function DeckSimulator({ deck }: DeckSimulatorProps) {
  const [hand, setHand] = useState<HandCard[]>([]);
  const [arsenal, setArsenal] = useState<DeckPrinting | null>(null);
  const [deckCards, setDeckCards] = useState<DeckPrinting[]>([]);
  const [graveyard, setGraveyard] = useState<DeckPrinting[]>([]);
  const [banished, setBanished] = useState<DeckPrinting[]>([]);
  const [resources, setResources] = useState(0);
  const [turnNumber, setTurnNumber] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);

  // Initialize deck from maindeck
  const initializeDeck = () => {
    const shuffledDeck = [...deck.maindeck].sort(() => Math.random() - 0.5);
    setDeckCards(shuffledDeck);
    setHand([]);
    setArsenal(null);
    setGraveyard([]);
    setBanished([]);
    setResources(0);
    setTurnNumber(0);
    setGameStarted(true);
  };

  // Draw cards
  const drawCards = (count: number) => {
    const drawn = deckCards.slice(0, count);
    const remaining = deckCards.slice(count);

    setHand(drawn.map(printing => ({ printing, action: "unused" as CardAction })));
    setDeckCards(remaining);
    setTurnNumber(prev => prev + 1);
  };

  // Start game - draw opening hand
  const startGame = () => {
    initializeDeck();
    // Will draw 4 cards on first turn
  };

  // Auto-draw on game start or new turn
  React.useEffect(() => {
    if (gameStarted && hand.length === 0 && deckCards.length > 0) {
      drawCards(Math.min(4, deckCards.length));
    }
  }, [gameStarted, hand.length, deckCards.length]);

  // Set card action
  const setCardAction = (index: number, action: CardAction) => {
    setHand(prev => prev.map((card, i) =>
      i === index ? { ...card, action } : card
    ));
  };

  // Get card stats
  const getCardStats = (printing: DeckPrinting) => {
    const details = printing.printingDetails || {};
    return {
      name: details.display_name || details.name || "Unknown",
      attack: details.power || 0,
      defense: details.defense || 0,
      cost: details.cost || 0,
      pitch: details.pitch || 0,
      image: details.image_url || details.image_uris?.front || "/placeholder-card.png"
    };
  };

  // Calculate turn value
  const turnValue = useMemo(() => {
    let attackValue = 0;
    let defenseValue = 0;
    let resourcesGenerated = 0;
    let cardsUsed = 0;

    hand.forEach(({ printing, action }) => {
      const stats = getCardStats(printing);

      if (action === "attack") {
        attackValue += stats.attack;
        cardsUsed++;
      } else if (action === "defend") {
        defenseValue += stats.defense;
        cardsUsed++;
      } else if (action === "pitch") {
        resourcesGenerated += stats.pitch;
        cardsUsed++;
      } else if (action === "play") {
        // Playing a card (instant, item, etc.) - counts as 3 points of value
        // This represents the card's effect/utility value
        attackValue += 3; // Generic value for playing the card
        cardsUsed++;
      }
    });

    const totalValue = attackValue + defenseValue + resourcesGenerated;
    const efficiency = cardsUsed > 0 ? totalValue / (cardsUsed * 3) : 0;

    return {
      attackValue,
      defenseValue,
      resourcesGenerated,
      totalValue,
      cardsUsed,
      efficiency: efficiency * 100 // Convert to percentage
    };
  }, [hand]);

  // End turn
  const endTurn = () => {
    // Move cards to graveyard based on actions
    const toGraveyard = hand.filter(c => c.action !== "arsenal").map(c => c.printing);
    const toArsenal = hand.find(c => c.action === "arsenal");

    setGraveyard(prev => [...prev, ...toGraveyard]);
    if (toArsenal) {
      setArsenal(toArsenal.printing);
    }

    // Reset for next turn
    setHand([]);
    setResources(0);
  };

  // Reset game
  const resetGame = () => {
    setGameStarted(false);
    setHand([]);
    setDeckCards([]);
    setGraveyard([]);
    setBanished([]);
    setArsenal(null);
    setResources(0);
    setTurnNumber(0);
  };

  if (!gameStarted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <h2 className="text-2xl font-bold">Deck Simulator</h2>
        <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
          Practice optimal play lines and understand card value using the 3-point system.
          Each card is worth ~3 points of value (attack/defense/resources).
        </p>
        <Button onClick={startGame} size="lg">
          <Shuffle className="mr-2 h-5 w-5" />
          Start Simulation
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Turn Value Analysis - Compact */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-500 rounded-lg p-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Turn Value:</div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-600 dark:text-gray-400">⚔️</span>
                <span className="font-bold text-red-600">{turnValue.attackValue}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-600 dark:text-gray-400">🛡️</span>
                <span className="font-bold text-blue-600">{turnValue.defenseValue}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-600 dark:text-gray-400">💎</span>
                <span className="font-bold text-yellow-600">{turnValue.resourcesGenerated}</span>
              </div>
              <div className="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-600 dark:text-gray-400">Total:</span>
                <span className="font-bold">{turnValue.totalValue}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600 dark:text-gray-400">Efficiency:</span>
            <div className={`text-lg font-bold ${
              turnValue.efficiency >= 100 ? "text-green-600" :
              turnValue.efficiency >= 80 ? "text-yellow-600" :
              "text-red-600"
            }`}>
              {turnValue.efficiency.toFixed(0)}%
            </div>
            <span className="text-xs">
              {turnValue.efficiency >= 100 && "🎯"}
              {turnValue.efficiency >= 80 && turnValue.efficiency < 100 && "⚖️"}
              {turnValue.efficiency < 80 && "⚠️"}
            </span>
          </div>
        </div>
      </div>

      {/* Hand */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold">Hand ({hand.length} cards)</h3>
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
            return (
              <div key={index} className="space-y-2 max-w-[160px]">
                <div className={`relative rounded-lg overflow-hidden border-2 ${
                  handCard.action === "attack" ? "border-red-500" :
                  handCard.action === "defend" ? "border-blue-500" :
                  handCard.action === "pitch" ? "border-yellow-500" :
                  handCard.action === "arsenal" ? "border-purple-500" :
                  handCard.action === "play" ? "border-green-500" :
                  "border-gray-300"
                }`}>
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
                  <div className="font-semibold truncate">{stats.name}</div>
                  <div className="flex gap-2">
                    <Badge variant="outline">⚔️ {stats.attack}</Badge>
                    <Badge variant="outline">🛡️ {stats.defense}</Badge>
                    <Badge variant="outline">💎 {stats.pitch}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1">
                  <Button
                    size="sm"
                    variant={handCard.action === "attack" ? "default" : "outline"}
                    onClick={() => setCardAction(index, handCard.action === "attack" ? "unused" : "attack")}
                    className="text-xs"
                  >
                    Attack
                  </Button>
                  <Button
                    size="sm"
                    variant={handCard.action === "defend" ? "default" : "outline"}
                    onClick={() => setCardAction(index, handCard.action === "defend" ? "unused" : "defend")}
                    className="text-xs"
                  >
                    Defend
                  </Button>
                  <Button
                    size="sm"
                    variant={handCard.action === "pitch" ? "default" : "outline"}
                    onClick={() => setCardAction(index, handCard.action === "pitch" ? "unused" : "pitch")}
                    className="text-xs"
                  >
                    Pitch
                  </Button>
                  <Button
                    size="sm"
                    variant={handCard.action === "play" ? "default" : "outline"}
                    onClick={() => setCardAction(index, handCard.action === "play" ? "unused" : "play")}
                    className="text-xs"
                  >
                    Play
                  </Button>
                  <Button
                    size="sm"
                    variant={handCard.action === "arsenal" ? "default" : "outline"}
                    onClick={() => setCardAction(index, handCard.action === "arsenal" ? "unused" : "arsenal")}
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
          <div className="text-center py-8 text-gray-500">
            Deck exhausted. Click Reset to start a new game.
          </div>
        )}
      </div>
    </div>
  );
}
