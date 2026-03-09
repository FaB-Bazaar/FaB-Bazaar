import { printingsService } from '@/lib/services';
import PublicHeroCardDisplay from './PublicHeroCardDisplay';

export default async function HeroCard({ printingId }: { printingId: string }) {
  try {
    const result = await printingsService.getPrintingById(printingId);

    if (!result.success || !result.data) {
      return (
        <div className="w-full aspect-[63/88] flex items-center justify-center bg-muted rounded-lg border">
          <span className="text-xs text-muted-foreground">Card not found: {printingId}</span>
        </div>
      );
    }

    return <PublicHeroCardDisplay card={result.data} />;

  } catch (error) {
    console.error(`[HeroCard Error] Failed to fetch printingId ${printingId}:`, error);
    return (
      <div className="w-full aspect-[63/88] flex items-center justify-center bg-destructive rounded-lg border">
        <span className="text-xs text-destructive-foreground">Load Error</span>
      </div>
    );
  }
}
