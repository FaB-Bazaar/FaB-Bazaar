/**
 * app/test/printing-i18n/[printingId]/page.tsx
 *
 * Two-block layout where the language chip swaps BOTH image and text:
 *   - Top block:    image + text in viewer language (?lang=, default 'en').
 *                   The printing is auto-picked to match the language, with
 *                   the URL printing_id as the anchor for picking the
 *                   closest variant.
 *   - Bottom block: image + text in the user's native language
 *                   (?native=, default 'en'). The "comfort" reference view.
 *                   Hidden when viewer lang === native lang.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getCardWithTranslation,
  findBestPrintingForCard,
  type PrintingWithTranslation,
} from '@/lib/postgres/queries/cardWithTranslation';

const SUPPORTED_LANGUAGES = ['en', 'fr', 'de', 'it', 'es', 'ja'] as const;

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  es: 'Español',
  ja: '日本語',
};

interface PageProps {
  params: Promise<{ printingId: string }>;
  searchParams: Promise<{ lang?: string; native?: string }>;
}

function LanguageBlock({
  view,
  role,
  requestedLanguage,
}: {
  view: PrintingWithTranslation;
  role: 'viewer' | 'native';
  requestedLanguage: string;
}) {
  const langLabel = LANGUAGE_LABELS[view.rendered_language] ?? view.rendered_language;
  const roleLabel = role === 'viewer' ? 'Viewer language' : 'Native language';
  const fellBack = view.rendered_language !== requestedLanguage;
  const printingMatchesText = view.printing_language === view.rendered_language;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide flex-wrap">
        <span className="px-2 py-0.5 rounded bg-foreground text-background font-mono">
          {view.rendered_language}
        </span>
        <span className="text-muted-foreground">{roleLabel}</span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{langLabel}</span>
        {fellBack && (
          <span className="text-amber-600 normal-case">
            (no {requestedLanguage} translation — fell back to en)
          </span>
        )}
        {!printingMatchesText && (
          <span className="text-blue-500 normal-case">
            (no {view.rendered_language} print available — showing {view.printing_language} art)
          </span>
        )}
      </div>

      <div className="grid grid-cols-[180px_1fr] gap-4">
        <div>
          {view.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={view.image_url}
              alt={view.display_name}
              className="w-full rounded shadow"
            />
          ) : (
            <div className="aspect-[5/7] bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">
              No image
            </div>
          )}
        </div>

        <div className="space-y-3 min-w-0">
          <div>
            <h2 className="text-xl font-bold">{view.display_name}</h2>
            {view.type_text && (
              <p className="text-sm text-muted-foreground mt-1">{view.type_text}</p>
            )}
          </div>

          {view.text && (
            <div className="text-sm whitespace-pre-wrap p-3 rounded bg-muted/50">
              {view.text}
            </div>
          )}

          {view.flavor_text && (
            <p className="text-xs italic text-muted-foreground">{view.flavor_text}</p>
          )}

          {view.traits && view.traits.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {view.traits.map(t => (
                <span key={t} className="px-2 py-0.5 text-xs rounded bg-muted">{t}</span>
              ))}
            </div>
          )}

          <p className="text-[10px] font-mono text-muted-foreground pt-1">
            printing_id: {view.printing_id} · {view.set.toUpperCase()} #{view.collector_number}
          </p>
        </div>
      </div>
    </section>
  );
}

export default async function PrintingI18nTestPage({ params, searchParams }: PageProps) {
  const { printingId: anchorPrintingId } = await params;
  const { lang: rawLang, native: rawNative } = await searchParams;

  const viewerLang = SUPPORTED_LANGUAGES.includes(rawLang as any) ? (rawLang as string) : 'en';
  const nativeLang = SUPPORTED_LANGUAGES.includes(rawNative as any) ? (rawNative as string) : 'en';

  // Resolve card_unique_id from the anchor printing
  const anchor = await getCardWithTranslation(anchorPrintingId, viewerLang);
  if (!anchor) notFound();

  // Pick the best printing for each language, anchored to the URL printing
  const viewerPrintingId = await findBestPrintingForCard(
    anchor.card_unique_id,
    viewerLang,
    anchorPrintingId,
  );
  const nativePrintingId = await findBestPrintingForCard(
    anchor.card_unique_id,
    nativeLang,
    anchorPrintingId,
  );

  const [viewerView, nativeView] = await Promise.all([
    getCardWithTranslation(viewerPrintingId, viewerLang),
    getCardWithTranslation(nativePrintingId, nativeLang),
  ]);

  if (!viewerView || !nativeView) notFound();

  const sameLanguage = viewerLang === nativeLang;

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-4 text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">← Home</Link>
      </div>

      <div className="mb-6 p-3 rounded-md border bg-muted/30 text-sm space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium min-w-32">Viewer language:</span>
          {SUPPORTED_LANGUAGES.map(l => (
            <Link
              key={l}
              href={`?lang=${l}&native=${nativeLang}`}
              className={`px-2 py-0.5 rounded border text-xs uppercase font-mono ${
                l === viewerLang
                  ? 'bg-foreground text-background border-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {l}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium min-w-32">Native language:</span>
          {SUPPORTED_LANGUAGES.map(l => (
            <Link
              key={l}
              href={`?lang=${viewerLang}&native=${l}`}
              className={`px-2 py-0.5 rounded border text-xs uppercase font-mono ${
                l === nativeLang
                  ? 'bg-foreground text-background border-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {l}
            </Link>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Image and text follow the viewer language. The native-language block below is your
          comfort-language reference and hidden when both match.
        </p>
      </div>

      <div className="space-y-8">
        <LanguageBlock view={viewerView} role="viewer" requestedLanguage={viewerLang} />
        {!sameLanguage && (
          <div className="pt-8 border-t">
            <LanguageBlock view={nativeView} role="native" requestedLanguage={nativeLang} />
          </div>
        )}
      </div>

      <div className="mt-8 pt-4 border-t text-xs text-muted-foreground font-mono">
        card_unique_id: {anchor.card_unique_id} · anchor printing_id: {anchorPrintingId}
      </div>
    </div>
  );
}
