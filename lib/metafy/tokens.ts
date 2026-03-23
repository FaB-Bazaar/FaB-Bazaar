import { encryptAddress, decryptAddress } from '@/lib/encryption';

const METAFY_TOKEN_URL = 'https://metafy.gg/irk/oauth/token';
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // refresh if within 5 minutes of expiry

export function encryptMetafyTokens(
  accessToken: string,
  refreshToken: string
): {
  metafyAccessToken: string;
  metafyAccessTokenIv: string;
  metafyRefreshToken: string;
  metafyRefreshTokenIv: string;
} {
  const encryptedAccess = encryptAddress(accessToken);
  const encryptedRefresh = encryptAddress(refreshToken);
  return {
    metafyAccessToken: encryptedAccess.encrypted,
    metafyAccessTokenIv: encryptedAccess.iv,
    metafyRefreshToken: encryptedRefresh.encrypted,
    metafyRefreshTokenIv: encryptedRefresh.iv,
  };
}

export function decryptMetafyTokens(stored: {
  metafyAccessToken: string;
  metafyAccessTokenIv: string;
  metafyRefreshToken: string;
  metafyRefreshTokenIv: string;
}): { accessToken: string; refreshToken: string } {
  return {
    accessToken: decryptAddress({ encrypted: stored.metafyAccessToken, iv: stored.metafyAccessTokenIv, tag: '' }),
    refreshToken: decryptAddress({ encrypted: stored.metafyRefreshToken, iv: stored.metafyRefreshTokenIv, tag: '' }),
  };
}

/**
 * Returns a valid Metafy access token for the given user, refreshing if expired.
 * Returns null if the user has no linked Metafy account or if refresh fails
 * (caller should prompt the user to re-link their Metafy account).
 */
export async function getValidMetafyAccessToken(userId: string): Promise<string | null> {
  const { userService } = await import('@/lib/services');
  const result = await userService.getMetafyTokens(userId);
  if (!result.success || !result.data) return null;

  const { metafyId, metafyUsername, accessToken: encAccess, accessTokenIv, refreshToken: encRefresh, refreshTokenIv, tokenExpiry } = result.data;

  if (!encAccess || !accessTokenIv || !encRefresh || !refreshTokenIv) return null;

  const { accessToken, refreshToken } = decryptMetafyTokens({
    metafyAccessToken: encAccess,
    metafyAccessTokenIv: accessTokenIv,
    metafyRefreshToken: encRefresh,
    metafyRefreshTokenIv: refreshTokenIv,
  });

  // Token still valid
  if (tokenExpiry && tokenExpiry.getTime() - Date.now() > REFRESH_BUFFER_MS) {
    return accessToken;
  }

  // Token expired or near-expiry — attempt refresh
  const clientId = process.env.METAFY_CLIENT_ID;
  const clientSecret = process.env.METAFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('[MetafyTokens] Missing METAFY_CLIENT_ID or METAFY_CLIENT_SECRET');
    return null;
  }

  try {
    const response = await fetch(METAFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      console.warn('[MetafyTokens] Token refresh failed:', response.status);
      return null;
    }

    const tokenData: { access_token: string; refresh_token: string; expires_in: number } = await response.json();
    const newExpiry = new Date(Date.now() + tokenData.expires_in * 1000);

    await userService.linkMetafyAccount(userId, {
      metafyId,
      metafyUsername,
      metafyAccessToken: tokenData.access_token,
      metafyRefreshToken: tokenData.refresh_token,
      metafyTokenExpiry: newExpiry,
    });

    return tokenData.access_token;
  } catch (err) {
    console.error('[MetafyTokens] Token refresh error:', err);
    return null;
  }
}
