import { redirect } from "next/navigation";

// The rail deck page was trialled here before it became /decks/[deckId];
// keep old tester links working.
export default async function DeckV2Redirect({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  redirect(`/decks/${deckId}`);
}
