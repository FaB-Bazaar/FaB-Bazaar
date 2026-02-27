import connectToDatabase from '@/lib/mongodb';
import Printing from '@/models/Printing';
import type { IPrinting } from '@/models/Printing';
import { transformPrintingToPublicCard } from '@/types';

// We will create this new component in the next step.
import PublicHeroCardDisplay from './PublicHeroCardDisplay'; 

export default async function HeroCard({ printingId }: { printingId: string }) {
  try {
    await connectToDatabase();

    const printing: IPrinting | null = await Printing.findOne({
      printing_id: printingId,
    }).lean();

    if (!printing) {
      return (
        <div className="w-full aspect-[63/88] flex items-center justify-center bg-muted rounded-lg border">
          <span className="text-xs text-muted-foreground">Card not found: {printingId}</span>
        </div>
      );
    }

    // Use the new, more powerful transformer
    const cardData = transformPrintingToPublicCard(printing);

    // Render the new, display-only client component
    return <PublicHeroCardDisplay card={cardData} />;

  } catch (error) {
    console.error(`[HeroCard Error] Failed to fetch printingId ${printingId}:`, error);
    return (
      <div className="w-full aspect-[63/88] flex items-center justify-center bg-destructive rounded-lg border">
        <span className="text-xs text-destructive-foreground">Load Error</span>
      </div>
    );
  }
}