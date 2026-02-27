// components/UserOAuthClientManager.tsx - NEW COMPONENT FOR YOUR SETTINGS PAGE
'use client';

import { useState, useEffect } from 'react';

interface OAuthClient {
  client_id: string;
  client_secret: string;
  client_name: string;
  created_at: string;
  last_used?: string;
}

export function UserOAuthClientManager({ userId }: { userId: string }) {
  const [clients, setClients] = useState<OAuthClient[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSecret, setShowSecret] = useState<string | null>(null);

  // Load user's existing OAuth clients
  useEffect(() => {
    fetchUserClients();
  }, [userId]);

  const fetchUserClients = async () => {
    try {
      const response = await fetch('/api/user/oauth-clients');
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error('Error fetching OAuth clients:', error);
    }
  };

  const generateNewClient = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/user/oauth-clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: `${username} MCP Client - ${new Date().toLocaleDateString()}`
        })
      });

      if (response.ok) {
        const newClient = await response.json();
        setClients(prev => [...prev, newClient]);
        setShowSecret(newClient.client_id); // Show the secret for copying
      } else {
        alert('Failed to generate client credentials');
      }
    } catch (error) {
      console.error('Error generating client:', error);
      alert('Error generating client credentials');
    } finally {
      setIsGenerating(false);
    }
  };

  const revokeClient = async (clientId: string) => {
    if (!confirm('Are you sure? This will break any applications using these credentials.')) {
      return;
    }

    try {
      const response = await fetch(`/api/user/oauth-clients/${clientId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setClients(prev => prev.filter(c => c.client_id !== clientId));
      } else {
        alert('Failed to revoke client');
      }
    } catch (error) {
      console.error('Error revoking client:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">MCP Client Credentials</h3>
          <p className="text-sm text-gray-600">
            Generate credentials for Claude Desktop and other MCP clients
          </p>
        </div>
        <button
          onClick={generateNewClient}
          disabled={isGenerating}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          {isGenerating ? 'Generating...' : 'Generate New Credentials'}
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No MCP client credentials generated yet.</p>
          <p className="text-sm">Click "Generate New Credentials" to create your first set.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {clients.map((client) => (
            <div key={client.client_id} className="border rounded-lg p-4 bg-gray-50">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-medium">{client.client_name}</h4>
                  <p className="text-sm text-gray-500">
                    Created: {new Date(client.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => revokeClient(client.client_id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Revoke
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Client ID</label>
                  <div className="flex mt-1">
                    <input
                      type="text"
                      value={client.client_id}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md bg-gray-100 text-sm font-mono"
                    />
                    <button
                      onClick={() => copyToClipboard(client.client_id)}
                      className="px-3 py-2 bg-gray-200 border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-300 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Client Secret</label>
                  <div className="flex mt-1">
                    <input
                      type={showSecret === client.client_id ? "text" : "password"}
                      value={client.client_secret}
                      readOnly
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md bg-gray-100 text-sm font-mono"
                    />
                    <button
                      onClick={() => setShowSecret(showSecret === client.client_id ? null : client.client_id)}
                      className="px-3 py-2 bg-gray-200 border border-l-0 border-gray-300 hover:bg-gray-300 text-sm"
                    >
                      {showSecret === client.client_id ? 'Hide' : 'Show'}
                    </button>
                    <button
                      onClick={() => copyToClipboard(client.client_secret)}
                      className="px-3 py-2 bg-gray-200 border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-300 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-md">
                <h5 className="text-sm font-medium text-blue-800 mb-2">Claude Desktop Configuration:</h5>
                <pre className="text-xs bg-blue-100 p-2 rounded overflow-x-auto">
{`{
  "mcpServers": {
    "fabbazaar": {
      "command": "mcp",
      "args": ["--server", "${window.location.origin}/api/mcp/server"],
      "env": {
        "CLIENT_ID": "${client.client_id}",
        "CLIENT_SECRET": "${client.client_secret}"
      }
    }
  }
}`}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}