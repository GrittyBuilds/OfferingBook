// Server-side helpers for coercing request bodies into safe DB values.

/** Convert a dollar amount (number or string like "1,000.50") to integer cents. */
export function dollarsToCents(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[$,\s]/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/** Trimmed string, or null when empty. */
export function str(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

/** 1/0 from any truthy/falsy input. */
export function bool(value) {
  return value ? 1 : 0;
}

/** Parse a number, or null. */
export function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Pick only allowed keys from an object. */
export function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}
