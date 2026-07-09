'use client';

import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Route-level error boundary: without this, any render crash in the chat
// shows Next's unstyled default error page — a bad look for the flagship
// supporter feature. The transcript lives in component state, so reset()
// starts a fresh chat; nothing durable is lost.
export default function VolzarError({ error, reset }: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[volzar] page error:', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center gap-5 px-4 py-16 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/volzar-icon.png"
        alt=""
        aria-hidden="true"
        className="h-14 w-14 rounded-full object-cover opacity-80 ring-2 ring-border grayscale"
      />
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Volzar short-circuited
        </h1>
        <p className="text-base text-gray-700 dark:text-gray-300">
          Something went wrong rendering the chat. Your binders, decks, and
          wants are untouched — this only affects the conversation on screen.
        </p>
      </div>
      <Button
        onClick={reset}
        className="gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" /> Restart the chat
      </Button>
    </div>
  );
}
