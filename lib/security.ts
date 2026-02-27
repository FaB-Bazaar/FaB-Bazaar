// lib/security.ts
//local IP testing
export function isDevelopmentWithLocalIPs(requestUrl: URL, refererUrl: URL): boolean {
  return (
    // Handle 0.0.0.0 hostname (when server bound to all interfaces, e.g. Docker)
    requestUrl.hostname === '0.0.0.0' ||
    // Check if either hostname is a local IP/localhost
    requestUrl.hostname.match(/^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.0\.0\.1|localhost)/) !== null ||
    refererUrl.hostname.match(/^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.|127\.0\.0\.1|localhost)/) !== null
  )
}