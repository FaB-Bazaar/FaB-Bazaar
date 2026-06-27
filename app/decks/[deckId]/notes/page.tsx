import { redirect } from "next/navigation";

// Deep link: /decks/[deckId]/notes opens the deck page with the Notes tab active.
// The deck editor is a single client page driven by a `tab` query param, so this
// just redirects there rather than duplicating the whole editor.
export default async function DeckNotesDeepLink({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  redirect(`/decks/${deckId}?tab=notes`);
}
