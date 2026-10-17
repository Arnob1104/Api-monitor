import { SEVERITY } from '../lib/format.js';

export default function SeverityBadge({ severity }) {
  const s = SEVERITY[severity];
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-sm font-bold ${s.tint} ${s.text}`}>
      {s.label}
    </span>
  );
}
