import { auth } from "@/auth";
import { userService } from '@/lib/services';

export default async function DebugAuthPage() {
  const session = await auth();

  console.log("=== DEBUG AUTH PAGE ===");
  console.log("Session:", JSON.stringify(session, null, 2));

  let userResult = null;
  let error = null;

  if (session?.user?.id) {
    try {
      userResult = await userService.getProfile(session.user.id);
      console.log("User Result:", JSON.stringify(userResult, null, 2));
    } catch (e: any) {
      error = e;
      console.error("Error fetching user:", e);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Auth Debug Page</h1>

      <div className="space-y-6">
        <div className="border p-4 rounded">
          <h2 className="text-xl font-semibold mb-2">Session</h2>
          <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>

        {session?.user?.id && (
          <div className="border p-4 rounded">
            <h2 className="text-xl font-semibold mb-2">
              getProfile({session.user.id}) Result
            </h2>
            {error ? (
              <div className="text-red-600">
                <strong>Error:</strong>
                <pre className="bg-red-50 p-2 rounded text-xs overflow-auto mt-2">
                  {error.toString()}
                </pre>
              </div>
            ) : (
              <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
                {JSON.stringify(userResult, null, 2)}
              </pre>
            )}
          </div>
        )}

        {userResult?.success && userResult.data && (
          <div className="border p-4 rounded">
            <h2 className="text-xl font-semibold mb-2">Authorization Check</h2>
            <ul className="space-y-1">
              <li>
                <strong>isSuperAdmin:</strong> {userResult.data.roles.isSuperAdmin ? '✅ true' : '❌ false'}
              </li>
              <li>
                <strong>isContentCreator:</strong> {userResult.data.roles.isContentCreator ? '✅ true' : '❌ false'}
              </li>
              <li>
                <strong>Has Access:</strong> {(userResult.data.roles.isSuperAdmin || userResult.data.roles.isContentCreator) ? '✅ YES' : '❌ NO'}
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
