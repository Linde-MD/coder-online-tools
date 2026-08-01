export function createNodeName(existingNames) {
  let idx = 1;
  while (existingNames.has(`ECU_${idx}`)) {
    idx += 1;
  }
  return `ECU_${idx}`;
}

export function createBusName(existingNames) {
  let idx = 1;
  while (existingNames.has(`CAN ${idx}`)) {
    idx += 1;
  }
  return `CAN ${idx}`;
}

export function ensureUniqueLabel(baseName, usedNames) {
  const normalized = String(baseName || '').trim() || 'Item';
  if (!usedNames.has(normalized)) {
    usedNames.add(normalized);
    return normalized;
  }
  let idx = 2;
  while (usedNames.has(`${normalized}_${idx}`)) {
    idx += 1;
  }
  const name = `${normalized}_${idx}`;
  usedNames.add(name);
  return name;
}

export function sanitizeFilenamePart(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}