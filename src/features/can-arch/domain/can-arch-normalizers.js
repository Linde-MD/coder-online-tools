export function normalizeProtocolsList(value, supportedProtocols) {
  const rawList = Array.isArray(value) ? value : [];
  const normalized = rawList.filter((token) => supportedProtocols.includes(token));
  return [...new Set(normalized)];
}

export function normalizeLinkStyle(styleInput, linkStyleOptions) {
  if (styleInput === 'straight') return 'polyline';
  return linkStyleOptions.includes(styleInput) ? styleInput : 'polyline';
}

export function normalizeIntegerList(value) {
  const rawList = Array.isArray(value)
    ? value
    : String(value || '')
      .split(/[;,，\s]+/)
      .map((part) => part.trim())
      .filter(Boolean);
  const normalized = rawList
    .map((item) => Number.parseInt(item, 10))
    .filter((num) => Number.isInteger(num));
  return [...new Set(normalized)];
}
