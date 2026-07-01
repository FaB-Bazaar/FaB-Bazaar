"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, RefreshCw, Trash2, Eye, EyeOff, Key } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface OAuthClient {
  client_id: string;
  client_secret: string;
  client_name: string;
  created_at: string;
  last_used?: string;
}

interface BearerToken {
  token: string;
  expires_at: string;
  created_at?: string;
}

export default function MCPIntegrationPage() {
  const { data: session, status } = useSession();
  
  // Bearer Token state
  const [bearerToken, setBearerToken] = useState<BearerToken | null>(null);
  const [isGeneratingBearer, setIsGeneratingBearer] = useState(false);
  const [showBearerToken, setShowBearerToken] = useState(false);
  const [copiedBearer, setCopiedBearer] = useState(false);
  
  // OAuth Clients state
  const [oauthClients, setOAuthClients] = useState<OAuthClient[]>([]);
  const [isGeneratingClient, setIsGeneratingClient] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Set<string>>(new Set());
  const [copiedCredentials, setCopiedCredentials] = useState<Set<string>>(new Set());
  
  const [copiedServerUrl, setCopiedServerUrl] = useState(false);
  const [error, setError] = useState<string>('');

  const isSuperAdmin = !!(session?.user?.roles as any)?.isSuperAdmin;

  const mcpServerUrl = 'https://fabbazaar.app/api/mcp/server';
  const mcpUrl = mcpServerUrl; // Token must be sent as Authorization: Bearer <token> header, not in URL

  useEffect(() => {
    if (session?.user) {
      fetchOAuthClients();
      fetchBearerToken();
    }
  }, [session]);

  // Bearer Token functions
  const fetchBearerToken = async () => {
    try {
      const response = await fetch('/api/oauth/get-bearer');
      if (response.ok) {
        const data = await response.json();
        if (data.access_token) {
          setBearerToken({
            token: data.access_token,
            expires_at: data.expires_at,
            created_at: data.created_at
          });
        }
      }
    } catch (error) {
      console.error('Error fetching bearer token:', error);
    }
  };

  const generateBearerToken = async () => {
    setIsGeneratingBearer(true);
    setError('');
    try {
      const response = await fetch('/api/oauth/generate-bearer', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to generate Bearer token');
      }

      const data = await response.json();
      setBearerToken({
        token: data.access_token,
        expires_at: data.expires_at,
        created_at: new Date().toISOString()
      });
      
      // Auto-show the token
      setShowBearerToken(true);
      
    } catch (error) {
      setError('Failed to generate Bearer token. Please try again.');
      console.error('Error generating Bearer token:', error);
    } finally {
      setIsGeneratingBearer(false);
    }
  };

  // OAuth Client functions
  const fetchOAuthClients = async () => {
    try {
      const response = await fetch('/api/user/oauth-clients');
      if (response.ok) {
        const data = await response.json();
        setOAuthClients(data.clients || []);
      }
    } catch (error) {
      console.error('Error fetching OAuth clients:', error);
    }
  };

  const generateOAuthClient = async () => {
    setIsGeneratingClient(true);
    setError('');
    try {
      const response = await fetch('/api/user/oauth-clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: `MCP Client - ${new Date().toLocaleDateString()}`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate OAuth client');
      }

      const newClient = await response.json();
      setOAuthClients(prev => [newClient, ...prev]);
      
      // Auto-show the secret for the new client
      setShowSecrets(prev => new Set([...prev, newClient.client_id]));
      
    } catch (error) {
      setError('Failed to generate OAuth client credentials. Please try again.');
      console.error('Error generating OAuth client:', error);
    } finally {
      setIsGeneratingClient(false);
    }
  };

  const revokeOAuthClient = async (clientId: string) => {
    if (!confirm('Are you sure? This will break any applications using these credentials.')) {
      return;
    }

    try {
      const response = await fetch(`/api/user/oauth-clients/${clientId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setOAuthClients(prev => prev.filter(c => c.client_id !== clientId));
        setShowSecrets(prev => {
          const newSet = new Set(prev);
          newSet.delete(clientId);
          return newSet;
        });
      } else {
        setError('Failed to revoke client credentials');
      }
    } catch (error) {
      console.error('Error revoking client:', error);
      setError('Failed to revoke client credentials');
    }
  };

  // Copy functions
  const copyToClipboard = async (text: string, type: string, id?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      
      if (type === 'serverUrl') {
        setCopiedServerUrl(true);
        setTimeout(() => setCopiedServerUrl(false), 2000);
      } else if (type === 'token') {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
      } else if (type === 'url') {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      } else if (type === 'bearer') {
        setCopiedBearer(true);
        setTimeout(() => setCopiedBearer(false), 2000);
      } else if (type === 'credential' && id) {
        setCopiedCredentials(prev => new Set([...prev, id]));
        setTimeout(() => {
          setCopiedCredentials(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
          });
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const toggleSecretVisibility = (clientId: string) => {
    setShowSecrets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  if (status === 'loading') {
    return (
      <div className="container mx-auto py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center text-gray-900 dark:text-gray-100">Loading...</div>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container mx-auto py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-gray-100">MCP Integration</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Please log in to configure MCP integration with Claude and other clients.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="border-gray-300 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-gray-100">MCP Integration</CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Connect your FabBazaar account with Claude Desktop/Web and other MCP clients.
              Claude supports full OAuth 2.1 authentication with token refresh and PKCE.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="oauth" className="w-full">
              <TabsList className={`grid w-full bg-gray-100 dark:bg-gray-800 ${isSuperAdmin ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <TabsTrigger
                  value="oauth"
                  className="data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-900 dark:data-[state=active]:text-gray-100 text-gray-700 dark:text-gray-300"
                >
                  OAuth (Recommended)
                </TabsTrigger>
                {isSuperAdmin && (
                  <TabsTrigger
                    value="bearer"
                    className="data-[state=active]:bg-white data-[state=active]:text-gray-900 dark:data-[state=active]:bg-gray-900 dark:data-[state=active]:text-gray-100 text-gray-700 dark:text-gray-300"
                  >
                    Bearer Token (Admin)
                  </TabsTrigger>
                )}
              </TabsList>
              
              {/* Bearer Token Tab - Admin only */}
              {isSuperAdmin && <TabsContent value="bearer" className="space-y-6">
                <Alert className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50">
                  <Key className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-blue-800 dark:text-blue-200">
                    <strong>Quick Setup:</strong> Simple Bearer token that works with Authorization headers.
                    Perfect for testing or MCP clients that support Bearer tokens. For production Claude Desktop use, we recommend OAuth instead.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Bearer Token</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Generate a Bearer token for Authorization header authentication
                      </p>
                    </div>
                    <Button
                      onClick={generateBearerToken}
                      disabled={isGeneratingBearer}
                      className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
                    >
                      {isGeneratingBearer ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        bearerToken ? 'Regenerate Token' : 'Generate Token'
                      )}
                    </Button>
                  </div>

                  {bearerToken ? (
                    <Card className="bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700">
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <h4 className="font-medium text-gray-900 dark:text-gray-100">Bearer Token</h4>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              Created: {bearerToken.created_at ? new Date(bearerToken.created_at).toLocaleDateString() : 'Recently'}
                              <br />
                              Expires: {new Date(bearerToken.expires_at).toLocaleDateString()}
                            </div>
                          </div>

                          <div>
                            <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Access Token</Label>
                            <div className="flex mt-1">
                              <Input
                                type={showBearerToken ? "text" : "password"}
                                value={bearerToken.token}
                                readOnly
                                className="font-mono text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                              />
                              <Button
                                onClick={() => setShowBearerToken(!showBearerToken)}
                                variant="outline"
                                size="sm"
                                className="ml-2 border-gray-300 dark:border-gray-600"
                              >
                                {showBearerToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </Button>
                              <Button
                                onClick={() => copyToClipboard(bearerToken.token, 'bearer')}
                                variant="outline"
                                size="sm"
                                className="ml-2 border-gray-300 dark:border-gray-600"
                              >
                                <Copy className="w-4 h-4" />
                                {copiedBearer ? 'Copied!' : 'Copy'}
                              </Button>
                            </div>
                          </div>

                          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/50 rounded-md border border-blue-200 dark:border-blue-800">
                            <h5 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                              MCP Client Configuration:
                            </h5>
                            <div className="space-y-2 text-xs">
                              <div>
                                <strong className="text-blue-900 dark:text-blue-100">URL:</strong>
                                <code className="ml-2 bg-blue-100 dark:bg-blue-900/50 px-1 rounded text-blue-900 dark:text-blue-100">
                                  {mcpServerUrl}
                                </code>
                              </div>
                              <div>
                                <strong className="text-blue-900 dark:text-blue-100">Authentication:</strong>
                                <code className="ml-2 bg-blue-100 dark:bg-blue-900/50 px-1 rounded text-blue-900 dark:text-blue-100">
                                  Bearer {bearerToken.token.substring(0, 20)}...
                                </code>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Alert className="border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                      <AlertDescription className="text-gray-700 dark:text-gray-300">
                        No Bearer token generated yet. Click "Generate Token" to create one for your MCP client.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </TabsContent>}

              {/* OAuth Credentials Tab */}
              <TabsContent value="oauth" className="space-y-6">
                <Alert className="border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/50">
                  <AlertDescription className="text-purple-800 dark:text-purple-200">
                    <strong>For Claude Desktop/Web (Recommended):</strong> Full OAuth 2.1 support with Dynamic Client Registration,
                    token refresh, and PKCE. Perfect for production use. Use redirect URI: <code className="bg-purple-100 dark:bg-purple-900/50 px-1 rounded">https://claude.ai/api/mcp/auth_callback</code>
                    <br /><br />
                    <strong>For other MCP clients:</strong> Also supports standard OAuth flows.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">OAuth Client Credentials</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Your credentials for connecting Claude and other MCP clients
                      </p>
                    </div>
                    <Button
                      onClick={generateOAuthClient}
                      disabled={isGeneratingClient}
                      className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600"
                    >
                      {isGeneratingClient ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : oauthClients.length > 0 ? (
                        'Regenerate Credentials'
                      ) : (
                        'Generate Credentials'
                      )}
                    </Button>
                  </div>

                  {oauthClients.length === 0 ? (
                    <Alert className="border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                      <AlertDescription className="text-gray-700 dark:text-gray-300">
                        No credentials yet. Click "Generate Credentials" to get started.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-4">
                      {oauthClients.map((client) => (
                        <Card key={client.client_id} className="bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700">
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h4 className="font-medium text-gray-900 dark:text-gray-100">{client.client_name}</h4>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  Created: {new Date(client.created_at).toLocaleDateString()}
                                  {client.last_used && (
                                    <span className="ml-2">
                                      • Last used: {new Date(client.last_used).toLocaleDateString()}
                                    </span>
                                  )}
                                </p>
                              </div>
                              <Button
                                onClick={() => revokeOAuthClient(client.client_id)}
                                variant="destructive"
                                size="sm"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Revoke
                              </Button>
                            </div>

                            <div className="space-y-3">
                              <div>
                                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Client ID</Label>
                                <div className="flex mt-1">
                                  <Input
                                    value={client.client_id}
                                    readOnly
                                    className="font-mono text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                                  />
                                  <Button
                                    onClick={() => copyToClipboard(client.client_id, 'credential', client.client_id)}
                                    variant="outline"
                                    size="sm"
                                    className="ml-2 border-gray-300 dark:border-gray-600"
                                  >
                                    <Copy className="w-4 h-4" />
                                    {copiedCredentials.has(client.client_id) ? 'Copied!' : 'Copy'}
                                  </Button>
                                </div>
                              </div>

                              <div>
                                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Client Secret</Label>
                                <div className="flex mt-1">
                                  <Input
                                    type={showSecrets.has(client.client_id) ? "text" : "password"}
                                    value={client.client_secret}
                                    readOnly
                                    className="font-mono text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
                                  />
                                  <Button
                                    onClick={() => toggleSecretVisibility(client.client_id)}
                                    variant="outline"
                                    size="sm"
                                    className="ml-2 border-gray-300 dark:border-gray-600"
                                  >
                                    {showSecrets.has(client.client_id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </Button>
                                  <Button
                                    onClick={() => copyToClipboard(client.client_secret, 'credential', client.client_id)}
                                    variant="outline"
                                    size="sm"
                                    className="ml-2 border-gray-300 dark:border-gray-600"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-950/50 rounded-md border border-purple-200 dark:border-purple-800">
                              <h5 className="text-sm font-medium text-purple-800 dark:text-purple-200 mb-2">
                                Claude Desktop Configuration:
                              </h5>
                              <div className="space-y-2 text-xs">
                                <div>
                                  <strong className="text-purple-900 dark:text-purple-100">Server URL:</strong>
                                  <div className="flex items-center gap-2 mt-1">
                                    <code className="bg-purple-100 dark:bg-purple-900/50 px-1 rounded text-purple-900 dark:text-purple-100 flex-1 break-all">
                                      {mcpServerUrl}
                                    </code>
                                    <Button
                                      onClick={() => copyToClipboard(mcpServerUrl, 'serverUrl')}
                                      variant="outline"
                                      size="sm"
                                      className="border-purple-300 dark:border-purple-700 text-purple-800 dark:text-purple-200 shrink-0"
                                    >
                                      <Copy className="w-3 h-3 mr-1" />
                                      {copiedServerUrl ? 'Copied!' : 'Copy'}
                                    </Button>
                                  </div>
                                </div>
                                <div>
                                  <strong className="text-purple-900 dark:text-purple-100">OAuth Endpoints:</strong>
                                  <div className="ml-2 space-y-1">
                                    <div>
                                      <span className="text-purple-800 dark:text-purple-300">Authorization:</span>
                                      <code className="ml-1 bg-purple-100 dark:bg-purple-900/50 px-1 rounded text-purple-900 dark:text-purple-100">
                                        https://fabbazaar.app/oauth/authorize
                                      </code>
                                    </div>
                                    <div>
                                      <span className="text-purple-800 dark:text-purple-300">Token:</span>
                                      <code className="ml-1 bg-purple-100 dark:bg-purple-900/50 px-1 rounded text-purple-900 dark:text-purple-100">
                                        https://fabbazaar.app/oauth/token
                                      </code>
                                    </div>
                                  </div>
                                </div>
                                <div>
                                  <strong className="text-purple-900 dark:text-purple-100">Redirect URI (Claude):</strong>
                                  <code className="ml-2 bg-purple-100 dark:bg-purple-900/50 px-1 rounded text-purple-900 dark:text-purple-100">
                                    https://claude.ai/api/mcp/auth_callback
                                  </code>
                                </div>
                                <div className="mt-2 pt-2 border-t border-purple-200 dark:border-purple-700">
                                  <p className="text-purple-800 dark:text-purple-300 italic">
                                    Add this remote MCP server in Claude via <strong>Settings → Connectors</strong>
                                  </p>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

            </Tabs>

            {error && (
              <Alert variant="destructive" className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50">
                <AlertDescription className="text-red-800 dark:text-red-200">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4 pt-6 border-t border-gray-300 dark:border-gray-700">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Setup Instructions</h4>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li>Generate your credentials using one of the methods above</li>
                <li>Configure your MCP client with the appropriate authentication method</li>
                <li><strong>For Claude Desktop/Web (Recommended):</strong> Use OAuth Credentials tab with redirect URI <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">https://claude.ai/api/mcp/auth_callback</code></li>
                <li><strong>For quick setup:</strong> Use the Bearer Token tab</li>
                <li>Add the remote MCP server in Claude via Settings → Connectors</li>
                <li>Verify FabBazaar appears in your available tools</li>
              </ol>
              
              <div className="space-y-2">
                <h5 className="font-medium text-gray-900 dark:text-gray-100">Example queries you can try:</h5>
                <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
                  <li>"Show me my wants list"</li>
                  <li>"What Monarch cards are under $50?"</li>
                  <li>"Add Command and Conquer to my collection"</li>
                  <li>"Search for light heroes"</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}