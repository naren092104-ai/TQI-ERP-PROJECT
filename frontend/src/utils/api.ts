export const API_BASE_URL: string = (
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? 'https://tqi.autorevives.com/api'
    : 'http://localhost:5000/api')
).replace(/\/$/, '');

export function apiUrl(path: string): string {
  if (!path) return API_BASE_URL;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

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
  return `${API_BASE_URL}${cleanPath}`;
}


