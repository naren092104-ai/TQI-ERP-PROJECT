export const API_BASE_URL: string = (
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? 'https://tqi.autorevives.com/api'
    : 'http://localhost:5000/api')
).replace(/\/$/, '');

export function apiUrl(path: string): string {
  if (!path) return API_BASE_URL;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/api/')) {
    return `${API_BASE_URL}${cleanPath.slice(4)}`;
  }
  if (cleanPath === '/api') {
    return API_BASE_URL;
  }
  return `${API_BASE_URL}${cleanPath}`;
}


