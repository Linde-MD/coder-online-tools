import {
  BUS_COLOR_POOL,
  BUS_RADIUS,
  NODE_HEIGHT,
  NODE_WIDTH,
} from '@/features/can-arch/domain/can-arch-constants.js';
import {
  buildNodeCardStyle,
  mixWithBlack,
  mixWithWhite,
  normalizeNodeBaseColor,
} from '@/features/can-arch/domain/can-arch-colors.js';
import {
  escapeXml,
} from '@/features/can-arch/domain/can-arch-xml.js';
import { nodeProtocolGroups } from '@/features/can-arch/domain/can-arch-protocols.js';

export function resolveExportBounds(nodes, buses, sceneSize, crop, padding = 28) {
  if (!crop || !nodes || nodes.length === 0) {
    return {
      x: 0,
      y: 0,
      width: Math.max(420, sceneSize ? sceneSize.width : 800),
      height: Math.max(420, sceneSize ? sceneSize.height : 600),
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + NODE_WIDTH);
    maxY = Math.max(maxY, node.position.y + NODE_HEIGHT);
  }
  for (const bus of buses) {
    minX = Math.min(minX, bus.position.x);
    minY = Math.min(minY, bus.position.y);
    maxX = Math.max(maxX, bus.position.x + BUS_RADIUS * 2);
    maxY = Math.max(maxY, bus.position.y + BUS_RADIUS * 2);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { x: 0, y: 0, width: 420, height: 420 };
  }

  const x = Math.floor(minX - padding);
  const y = Math.floor(minY - padding);
  const width = Math.max(1, Math.ceil(maxX - minX + padding * 2));
  const height = Math.max(1, Math.ceil(maxY - minY + padding * 2));
  return { x, y, width, height };
}

export function buildArchitectureSvg({
  nodes,
  buses,
  resolvedLinks,
  includeBackground = true,
  crop = false,
  sceneSize,
}) {
  const bounds = resolveExportBounds(nodes, buses, sceneSize, crop);
  const width = bounds.width;
  const height = bounds.height;

  const nodeBlocks = (nodes || []).map((node) => {
    const base = normalizeNodeBaseColor(node.baseColor);
    const borderColor = mixWithBlack(base, 0.1);
    const fillTop = mixWithWhite(base, 0.9);
    const fillBottom = mixWithWhite(base, 0.8);
    const accentStart = mixWithBlack(base, 0.12);
    const accentEnd = mixWithWhite(base, 0.2);
    const protocolLines = nodeProtocolGroups(node)
      .map((group) => `${group.label}: ${group.addressText || '未配置地址'}`)
      .slice(0, 2);
    const line2 = protocolLines[0] || '';
    const line3 = protocolLines[1] || '';

    const x = node.position.x - bounds.x;
    const y = node.position.y - bounds.y;

    return `
      <g transform="translate(${x}, ${y})">
        <defs>
          <linearGradient id="node-fill-${escapeXml(node.id)}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${fillTop}"/>
            <stop offset="100%" stop-color="${fillBottom}"/>
          </linearGradient>
          <linearGradient id="node-accent-${escapeXml(node.id)}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${accentStart}"/>
            <stop offset="100%" stop-color="${accentEnd}"/>
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="12" fill="url(#node-fill-${escapeXml(node.id)})" stroke="${borderColor}"/>
        <rect x="0" y="0" width="8" height="${NODE_HEIGHT}" rx="8" fill="url(#node-accent-${escapeXml(node.id)})"/>
        <text x="14" y="24" font-size="13" font-weight="700" fill="#2f241c">${escapeXml(node.name)} ECU</text>
        ${line2 ? `<text x="14" y="48" font-size="11" fill="#5a4a3d">${escapeXml(line2)}</text>` : ''}
        ${line3 ? `<text x="14" y="66" font-size="11" fill="#6c6157">${escapeXml(line3)}</text>` : ''}
      </g>
    `;
  }).join('');

  const linkBlocks = (resolvedLinks || []).map((link) => {
    const shiftedPath = String(link.path || '')
      .replace(/\bM\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x, y) => `M ${Number(x) - bounds.x} ${Number(y) - bounds.y}`)
      .replace(/\bL\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x, y) => `L ${Number(x) - bounds.x} ${Number(y) - bounds.y}`)
      .replace(/\bQ\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g, (_, x1, y1, x2, y2) => `Q ${Number(x1) - bounds.x} ${Number(y1) - bounds.y} ${Number(x2) - bounds.x} ${Number(y2) - bounds.y}`);
    return `<path d="${shiftedPath}" stroke="${escapeXml(link.color)}" stroke-width="3" stroke-linecap="round" fill="none"/>`;
  }).join('');

  const busBlocks = (buses || []).map((bus) => {
    const cx = bus.position.x + BUS_RADIUS - bounds.x;
    const cy = bus.position.y + BUS_RADIUS - bounds.y;
    const r = BUS_RADIUS;
    const base = normalizeNodeBaseColor(bus.color);
    const edgeTop = mixWithWhite(base, 0.55);
    const edgeBottom = mixWithBlack(base, 0.3);
    return `
      <g transform="translate(${cx}, ${cy})">
        <defs>
          <radialGradient id="bus-fill-${escapeXml(bus.id)}" cx="0.35" cy="0.35" r="0.75">
            <stop offset="0%" stop-color="${edgeTop}"/>
            <stop offset="100%" stop-color="${edgeBottom}"/>
          </radialGradient>
        </defs>
        <circle r="${r}" fill="url(#bus-fill-${escapeXml(bus.id)})" stroke="${escapeXml(mixWithBlack(base, 0.15))}" stroke-width="2"/>
        <text x="0" y="5" text-anchor="middle" font-size="12" font-weight="700" fill="#ffffff">${escapeXml(bus.name)}</text>
      </g>
    `;
  }).join('');

  const backgroundBlock = includeBackground
    ? `<rect x="0" y="0" width="${width}" height="${height}" fill="#f8f4ee"/>`
    : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  ${backgroundBlock}
  ${busBlocks}
  ${nodeBlocks}
  ${linkBlocks}
</svg>`;

  return { svg, width, height };
}

export async function exportArchitecturePng({ svg, width, height }, { includeBackground = true, autoCrop = true }) {
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  const image = new Image();

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = svgUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    URL.revokeObjectURL(svgUrl);
    throw new Error('浏览器不支持 PNG 导出。');
  }

  context.drawImage(image, 0, 0, width, height);
  const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  URL.revokeObjectURL(svgUrl);
  if (!pngBlob) {
    throw new Error('PNG 编码失败。');
  }

  return pngBlob;
}

export function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadBlobFile(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function buildTimestampTag() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}