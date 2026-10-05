type ApiOptions = RequestInit & { retry?: boolean };

function cookie(name: string) {
  if (typeof document === 'undefined') return '';
  return document.cookie.split('; ').find((item) => item.startsWith(`${name}=`))?.split('=').slice(1).join('=') ?? '';
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const csrf = decodeURIComponent(cookie('csrf_token'));
  if (csrf) headers.set('x-csrf-token', csrf);
  const response = await fetch(`/api/v1${path}`, { ...options, headers, credentials: 'include' });
  if (response.status === 401 && options.retry !== false && path !== '/auth/refresh') {
    const refreshed = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include', headers: csrf ? { 'x-csrf-token': csrf } : {} });
    if (refreshed.ok) return api<T>(path, { ...options, retry: false });
  }
  const data = await response.json().catch(() => ({ message: 'Unable to process request' }));
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message[0] : data.message ?? 'Request failed');
  return data as T;
}
