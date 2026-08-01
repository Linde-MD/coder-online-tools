import { DEFAULT_NODE_BASE_COLOR } from './can-arch-constants.js';

export function parseHexColor(value) {
  const normalized = String(value || '').trim();
  const match = normalized.match(/^#([0-9a-fA-F]{6})$/);
  if (!match) return null;
  const hex = match[1];
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

export function toHex(num) {
  const clamp = Math.max(0, Math.min(255, num));
  return clamp.toString(16).padStart(2, '0');
}

export function normalizeNodeBaseColor(value, fallback = DEFAULT_NODE_BASE_COLOR) {
  const parsed = parseHexColor(value);
  if (!parsed) return fallback;
  return `#${toHex(parsed.r)}${toHex(parsed.g)}${toHex(parsed.b)}`;
}

export function mixWithWhite(hex, ratio) {
  const parsed = parseHexColor(hex) || parseHexColor(DEFAULT_NODE_BASE_COLOR);
  const weight = Math.max(0, Math.min(1, ratio));
  const mix = (channel) => Math.round(channel + (255 - channel) * weight);
  return `#${toHex(mix(parsed.r))}${toHex(mix(parsed.g))}${toHex(mix(parsed.b))}`;
}

export function mixWithBlack(hex, ratio) {
  const parsed = parseHexColor(hex) || parseHexColor(DEFAULT_NODE_BASE_COLOR);
  const weight = Math.max(0, Math.min(1, ratio));
  const mix = (channel) => Math.round(channel * (1 - weight));
  return `#${toHex(mix(parsed.r))}${toHex(mix(parsed.g))}${toHex(mix(parsed.b))}`;
}

function _getPosition(target) {
  if (target?.position && typeof target.position === 'object') {
    return { x: target.position.x ?? 0, y: target.position.y ?? 0 };
  }
  return { x: target?.x ?? 0, y: target?.y ?? 0 };
}

export function buildNodeCardStyle(node) {
  const pos = _getPosition(node);
  const base = normalizeNodeBaseColor(node?.baseColor);
  return {
    transform: `translate(${pos.x}px, ${pos.y}px)`,
    '--node-border': mixWithBlack(base, 0.1),
    '--node-bg-top': mixWithWhite(base, 0.9),
    '--node-bg-bottom': mixWithWhite(base, 0.8),
  };
}

export function buildBusCardStyle(bus) {
  const pos = _getPosition(bus);
  const color = normalizeNodeBaseColor(bus?.color);
  return {
    transform: `translate(${pos.x}px, ${pos.y}px)`,
    '--bus-color': color,
    '--bus-color-soft': mixWithWhite(color, 0.22),
    '--bus-color-deep': mixWithBlack(color, 0.2),
  };
}