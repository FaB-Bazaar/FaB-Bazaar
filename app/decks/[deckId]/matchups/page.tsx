"use client";

import React from "react";
import { useParams } from "next/navigation";
import MatchupArena from "@/components/deck/MatchupArena";

export default function DeckMatchupsPage() {
  const params = useParams();
  const deckId = params.deckId as string;
  return <MatchupArena deckId={deckId} />;
}
