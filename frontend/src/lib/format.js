// Full class names are written out so Tailwind can find them.
export const SEVERITY = {
  critical: { label: 'Critical', rank: 3, text: 'text-sev-critical', tint: 'bg-tint-critical', edge: 'bg-bar-critical', bar: 'bg-bar-critical' },
  high: { label: 'High', rank: 2, text: 'text-sev-high', tint: 'bg-tint-high', edge: 'bg-bar-high', bar: 'bg-bar-high' },
  medium: { label: 'Medium', rank: 1, text: 'text-sev-medium', tint: 'bg-tint-medium', edge: 'bg-bar-medium', bar: 'bg-bar-medium' },
  low: { label: 'Low', rank: 0, text: 'text-sev-low', tint: 'bg-tint-low', edge: 'bg-bar-low', bar: 'bg-bar-low' },
};
export const SEVERITY_KEYS = ['critical', 'high', 'medium', 'low'];

export const TYPE_LABELS = {
  SERVER_ERROR: 'Server error',
  CLIENT_ERROR: 'Request rejected',
  UNEXPECTED_STATUS: 'Unexpected status',
  HIGH_RESPONSE_TIME: 'Slow response',
  ZERO_RECORDS: 'No records',
  MISSING_DATA: 'Missing fields',
  INCONSISTENT_DATA: 'Inconsistent data',
};

export function timeAgo(iso) {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

export const formatDate = (iso) => new Date(iso).toLocaleString();
export const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);
