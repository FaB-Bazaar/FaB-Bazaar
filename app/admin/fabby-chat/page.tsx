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
    : ['mock', 'google/gemini-3.1-flash-lite', 'anthropic/claude-haiku-4.5'];

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-2">Fabby Chat (prototype)</h1>
      <p className="text-muted-foreground mb-6">
        Hosted agent loop over the lite MCP toolset — superadmin preview of the future hosted tier.
      </p>
      <FabbyChatClient
        username={user.name || 'collector'}
        mockMode={mockMode}
        models={models}
      />
    </div>
  );
}
