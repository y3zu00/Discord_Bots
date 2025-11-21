/**
 * Get the base API URL for backend requests.
 * In development, uses Vite proxy (relative path).
 * In production, uses VITE_API_URL environment variable.
 */
export function getApiUrl(): string {
  // In development, Vite proxy handles /api routes
  if (import.meta.env.DEV) {
    return '';
  }
  // In production, use the backend URL from environment variable
  return import.meta.env.VITE_API_URL || 'https://app.jackofalltrades.vip';
}

/**
 * Helper to make API calls with the correct base URL
 */
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = path.startsWith('/') ? `${baseUrl}${path}` : `${baseUrl}/${path}`;
  return fetch(url, {
    ...options,
    credentials: 'include',
    ...(options?.headers || {}),
  });
}

/**
 * Get the WebSocket URL for real-time connections
 */
export function getWebSocketUrl(): string {
  const baseUrl = getApiUrl();
  if (baseUrl) {
    // Production: use VITE_API_URL, convert http/https to ws/wss
    const wsBase = baseUrl.replace(/^https/, 'wss').replace(/^http/, 'ws');
    return `${wsBase}/ws`;
  }
  // Development: use current location
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

