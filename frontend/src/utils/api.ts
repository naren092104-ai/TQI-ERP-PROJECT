const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const isCloudflarePages = typeof window !== 'undefined'
  && window.location.hostname.endsWith('.pages.dev');
const defaultApiUrl = import.meta.env.PROD && isCloudflarePages
  ? 'https://tqi-academic-erp.vercel.app/api'
  : '/api';
export const API_BASE_URL = (configuredApiUrl || defaultApiUrl).replace(/\/+$/, '');
const externalApiOrigin = /^https?:\/\//i.test(API_BASE_URL)
  ? new URL(API_BASE_URL).origin
  : '';

export function apiUrl(path: string): string {
  if (!path) return API_BASE_URL;
  if (path.startsWith('data:') || path.startsWith('blob:')) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    if (!import.meta.env.PROD || externalApiOrigin) return path;
    try {
      const url = new URL(path);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return path;
    }
  }

  let cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (cleanPath.startsWith('/api/') && typeof window !== 'undefined') {
    try {
      const selectedAcademicYearId = window.localStorage.getItem('tqi_selected_academic_year_id');
      if (selectedAcademicYearId && !/[?&]academicYearId=/.test(cleanPath)) {
        const separator = cleanPath.includes('?') ? '&' : '?';
        cleanPath = `${cleanPath}${separator}academicYearId=${encodeURIComponent(selectedAcademicYearId)}`;
      }
    } catch {
      // Continue without year context if browser storage is unavailable.
    }
  }
  if (cleanPath.startsWith('/api/')) {
    return `${API_BASE_URL}${cleanPath.slice(4)}`;
  }
  if (cleanPath === '/api') {
    return API_BASE_URL;
  }
  if (cleanPath.startsWith('/storage/')) {
    return externalApiOrigin ? `${externalApiOrigin}${cleanPath}` : cleanPath;
  }
  return `${API_BASE_URL}${cleanPath}`;
}
