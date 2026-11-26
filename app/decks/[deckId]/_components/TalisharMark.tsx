// The Talishar coin, marking the list Talishar imports for a deck (the same
// image the deck list's Talishar toggle uses).
export default function TalisharMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <img
      src="https://talishar.net/assets/CoinLogo-CXy1VyVE.png"
      alt="Talishar plays this list"
      title="Talishar plays this list"
      className={`${className} shrink-0 object-contain`}
    />
  );
}
