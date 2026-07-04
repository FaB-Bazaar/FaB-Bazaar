import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { userService } from '@/lib/services';
import { FabbyChatClient } from './FabbyChatClient';

export const dynamic = 'force-dynamic';

// Superadmin-only prototype of the hosted AI tier: server-side agent loop
// over the lite MCP toolset, streamed to the browser. Gate pattern copied
// from app/admin/user-access/page.tsx.
export default async function FabbyChatAdminPage() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    redirect('/');
  }

  const roleCheck = await userService.hasRole(user.id, 'isSuperAdmin');
  if (!roleCheck.success || !roleCheck.data) {
    redirect('/admin/articles');
  }

  const mockMode = !process.env.OPENROUTER_API_KEY;
  const models = mockMode
    ? ['mock']
    : [
        'openai/gpt-5-nano',
        'openai/gpt-oss-120b',
        'openai/gpt-oss-120b:free',
        'google/gemini-2.5-flash-lite',
        'anthropic/claude-haiku-4.5',
        'mock',
      ];

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-4">
      <div className="flex flex-wrap items-baseline gap-x-3 mb-3">
        <h1 className="text-2xl font-bold">Fabby Chat (prototype)</h1>
        <p className="text-muted-foreground text-sm">
          Hosted agent loop over the lite MCP toolset — superadmin preview.
        </p>
      </div>
      <FabbyChatClient
        username={user.name || 'collector'}
        mockMode={mockMode}
        models={models}
      />
    </div>
  );
}
