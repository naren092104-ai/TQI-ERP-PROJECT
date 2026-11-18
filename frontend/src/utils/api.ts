/**
 * API URL Configuration
 *
 * Architecture:
 *   Frontend  →  Cloudflare Pages  (https://tqi-erp.pages.dev)
 *   Backend   →  Windows VPS       (https://tqi.autorevives.com)
 *
 * In Cloudflare Pages, set the build environment variable:
 *   VITE_API_URL = https://tqi.autorevives.com/api
 *
 * For local development the Vite dev server proxies /api to localhost:5000,
 * so the default relative '/api' works out of the box.
 */

const configuredApiUrl = (import.meta.env.VITE_API_URL || '').trim();

// In production on Cloudflare Pages the frontend and backend are on different
// domains, so VITE_API_URL must be an absolute URL like
// "https://tqi.autorevives.com/api". If it was not set (or is still the
// relative "/api" placeholder), fall back to the known production backend.
const isProduction = import.meta.env.PROD;
const isAbsoluteUrl = /^https?:\/\//i.test(configuredApiUrl);

const resolvedApiUrl = (() => {
  // 1. Explicit absolute URL set at build time — use it as-is.
  if (configuredApiUrl && isAbsoluteUrl) return configuredApiUrl;

  // 2. Production but no absolute URL configured — use the known backend.
  if (isProduction && (!configuredApiUrl || configuredApiUrl === '/api')) {
    return 'https://tqi.autorevives.com/api';
  }

  // 3. Local development — relative "/api" is proxied by Vite dev server.
  return configuredApiUrl || '/api';
})();

export const API_BASE_URL = resolvedApiUrl.replace(/\/+$/, '');

const externalApiOrigin = /^https?:\/\//i.test(API_BASE_URL)
  ? new URL(API_BASE_URL).origin
  : '';

export function apiUrl(path: string): string {
  if (!path) return API_BASE_URL;
  if (path.startsWith('data:') || path.startsWith('blob:')) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    if (!isProduction || externalApiOrigin) return path;
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
