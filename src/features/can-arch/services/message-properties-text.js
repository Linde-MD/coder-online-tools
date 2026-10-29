import JSON5 from 'json5';
import { CanMessage } from '../domain/models/CanMessage.js';
import { encodeJ1939IdFromPgn, formatHex, parseNumberInput } from '../../../shared/utils/j1939.js';
import { parsePropertyText, serializePropertyText } from './property-text-codec.js';
import { validateSignalLayout } from './signal-layout.js';

export const MESSAGE_PROPERTY_FIELDS = Object.freeze([
  'name', 'protocol', 'id', 'txMode', 'periodMs', 'byteOrder', 'dlc', 'dlcMode',
  'senders', 'receiverMode', 'receivers', 'comment',
]);
const J1939_FIELDS = ['pgn', 'priority', 'sa', 'da'];
const STORAGE_FIELDS = MESSAGE_PROPERTY_FIELDS.map((field) => field === 'id' ? 'idHex' : field);

export function serializeMessageProperties(message, format = 'json', participants = []) {
  const properties = Object.fromEntries(MESSAGE_PROPERTY_FIELDS.map((field) => [field, message[field]]));
  const validId = typeof message.idHex === 'string' && /^(?:0x)?[0-9a-f]+$/i.test(message.idHex);
  properties.id = validId ? Number.parseInt(message.idHex.replace(/^0x/i, ''), 16)
    : message.protocol === 'j1939' && message.j1939?.priority === 'dont_care' ? 0 : null;
  const namesById = new Map(participants.map((node) => [node.id, node.name]));
  for (const field of ['senders', 'receivers']) {
    properties[field] = (message[field] || []).map((id) => namesById.get(id) ?? null);
  }
  if (message.protocol === 'j1939') {
    properties.j1939 = Object.fromEntries(J1939_FIELDS.map((field) => [field, message.j1939?.[field] ?? '']));
  }
  return serializePropertyText(properties, format, { hexFields: ['id'] });
}

export function captureMessageProperties(message) {
  return {
    ...Object.fromEntries(STORAGE_FIELDS.map((field) => [field, message[field]])),
    senders: [...message.senders],
    receivers: [...message.receivers],
    color: message.color,
    j1939: message.j1939 ? { ...message.j1939 } : message.j1939,
  };
}

function checkFields(properties, fields, errors, prefix = '') {
  for (const field of fields) {
    if (!Object.hasOwn(properties, field)) errors.push(`缺少必要字段：${prefix}${field}。`);
  }
  for (const field of Object.keys(properties)) {
    if (!fields.includes(field)) errors.push(`无法识别的字段：${prefix}${field}。`);
  }
}

function validateParticipants(properties, context, errors) {
  const nodesByName = new Map();
  for (const node of context.participants || []) {
    if (!nodesByName.has(node.name)) nodesByName.set(node.name, []);
    nodesByName.get(node.name).push(node);
  }
  for (const field of ['senders', 'receivers']) {
    const names = properties[field];
    if (!Array.isArray(names) || names.some((name) => typeof name !== 'string' || !name.trim())) {
      errors.push(`${field} 必须是 ECU 名称字符串数组。`);
      continue;
    }
    if (new Set(names).size !== names.length) errors.push(`${field} 不允许重复 ECU 名称。`);
    const ids = [];
    for (const name of names) {
      const matches = nodesByName.get(name) || [];
      if (!matches.length) errors.push(`${field} 中找不到当前 BUS 上的 ECU 名称：${name}。`);
      else if (matches.length > 1) errors.push(`ECU 名称存在重名，无法确定节点：${name}。`);
      else ids.push(matches[0].id);
    }
    properties[field] = ids;
  }
  if (!Array.isArray(properties.senders) || !Array.isArray(properties.receivers)) return;
  if (!properties.senders.length) errors.push('至少需要一个发送方。');
  if (properties.receiverMode === 'broadcast') {
    if (properties.receivers.length) errors.push('广播模式的 receivers 必须为空数组。');
  } else if (properties.receiverMode === 'nodes' && !properties.receivers.length) {
    errors.push('节点接收模式至少需要一个接收方。');
  }
  if (context.pane === 'tx' && !properties.senders.includes(context.currentEcuId)) {
    errors.push('发送报文的 senders 必须包含当前 ECU。');
  }
  if (context.pane === 'rx' && properties.receiverMode === 'nodes'
    && !properties.receivers.includes(context.currentEcuId)) {
    errors.push('接收报文的 receivers 必须包含当前 ECU。');
  }
}

function normalizeJ1939(properties, context, rawId, errors) {
  const fields = properties.j1939;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    errors.push('J1939 协议必须提供 j1939 对象。');
    return null;
  }
  const initialErrors = errors.length;
  checkFields(fields, J1939_FIELDS, errors, 'j1939.');
  for (const field of J1939_FIELDS) {
    if (!['string', 'number'].includes(typeof fields[field])) {
      errors.push(`j1939.${field} 必须是数字或字符串。`);
    }
  }
  if (errors.length !== initialErrors) return null;
  const pgn = parseNumberInput(fields.pgn);
  const sa = parseNumberInput(fields.sa);
  const dontCare = fields.priority === 'dont_care';
  const priority = dontCare ? 0 : parseNumberInput(fields.priority);
  const isPdu2 = Number.isInteger(pgn) && ((pgn >> 8) & 0xFF) >= 240;
  const da = isPdu2 ? 0 : parseNumberInput(fields.da);
  if (isPdu2 && fields.da !== 'broadcast') errors.push('PDU2 的 j1939.da 必须为 broadcast。');
  const encoded = encodeJ1939IdFromPgn(pgn, priority, sa, da);
  if (!encoded.valid) errors.push(`J1939 配置错误：${encoded.error}`);
  if (encoded.valid && !dontCare && encoded.id !== rawId) {
    errors.push('J1939 字段与 ID 不一致，请检查 PGN/Priority/SA/DA。');
  }
  const nodes = new Map((context.participants || []).map((node) => [node.id, node]));
  for (const id of properties.senders || []) {
    if (!(nodes.get(id)?.j1939Addresses || []).some((address) => parseNumberInput(address) === sa)) {
      errors.push(`发送方 ${nodes.get(id)?.name || '未知 ECU'} 未配置 SA=${sa}。`);
    }
  }
  for (const id of properties.receivers || []) {
    const node = nodes.get(id);
    if (isPdu2) {
      if (!node?.protocols?.includes('j1939')) errors.push(`接收方 ${node?.name || '未知 ECU'} 未启用 J1939。`);
    } else if (!(node?.j1939Addresses || []).some((address) => parseNumberInput(address) === da)) {
      errors.push(`接收方 ${node?.name || '未知 ECU'} 未配置 DA=${da}。`);
    }
  }
  if (!isPdu2 && properties.receiverMode === 'broadcast') errors.push('PDU1 必须配置对应 DA 的节点接收方。');
  if (errors.length !== initialErrors) return null;
  return {
    ...context.message?.j1939,
    enabled: true,
    mode: 'id',
    id: dontCare ? context.message?.j1939?.id || '' : formatHex(encoded.id, 8),
    pgn: String(pgn),
    priority: dontCare ? 'dont_care' : priority,
    sa: String(sa),
    da: isPdu2 ? 'broadcast' : String(da),
  };
}

export function parseMessageProperties(text, context = {}, format = 'json') {
  const parsed = parsePropertyText(text, format, 'Message', JSON5.parse);
  if (parsed.errors.length) return parsed;
  const properties = parsed.value;
  const errors = [];
  const invalid = () => ({ value: null, errors });
  const fields = properties.protocol === 'j1939' ? [...MESSAGE_PROPERTY_FIELDS, 'j1939'] : MESSAGE_PROPERTY_FIELDS;
  checkFields(properties, fields, errors);
  if (errors.length) return invalid();
  if (typeof properties.name !== 'string' || !properties.name.trim()) errors.push('name 必须是非空字符串。');
  if (typeof properties.comment !== 'string') errors.push('comment 必须是字符串。');
  for (const [field, options] of Object.entries({
    protocol: ['generic_std', 'generic_ext', 'j1939', 'canopen'],
    txMode: ['periodic', 'event', 'mixed'],
    byteOrder: ['intel', 'motorola'],
    dlcMode: ['fixed', 'variable'],
    receiverMode: ['nodes', 'broadcast'],
  })) {
    if (!options.includes(properties[field])) errors.push(`${field} 必须为 ${options.join(' / ')}。`);
  }
  if (!Number.isInteger(properties.dlc) || properties.dlc < 0 || properties.dlc > 64) {
    errors.push('dlc 必须是 0-64 的整数字节数。');
  }
  if (properties.txMode === 'event') {
    if (properties.periodMs !== null) errors.push('事件模式的 periodMs 必须为 null。');
  } else if (!Number.isSafeInteger(properties.periodMs) || properties.periodMs < 0) {
    errors.push('periodMs 必须是非负整数。');
  }
  const dontCare = properties.protocol === 'j1939' && properties.j1939?.priority === 'dont_care';
  const rawId = properties.id;
  const extended = properties.protocol === 'generic_ext' || properties.protocol === 'j1939';
  if (!Number.isInteger(rawId) || rawId < 0 || rawId > (extended ? 0x1FFFFFFF : 0x7FF)) {
    errors.push(`id 必须是 0-${extended ? '0x1FFFFFFF' : '0x7FF'} 范围内的整数，不能使用字符串。`);
  }
  validateParticipants(properties, context, errors);
  if (errors.length) return invalid();
  const j1939 = properties.protocol === 'j1939'
    ? normalizeJ1939(properties, context, rawId, errors)
    : { ...context.message?.j1939, enabled: false };
  for (const signal of context.message?.signals || []) {
    const layout = validateSignalLayout(signal, properties);
    for (const error of [layout.messageError, layout.startBitError, layout.lengthError].filter(Boolean)) {
      errors.push(`Signal ${signal.name || signal.id}：${error}`);
    }
  }
  if (errors.length) return invalid();
  return {
    value: {
      ...Object.fromEntries(MESSAGE_PROPERTY_FIELDS.filter((field) => field !== 'id').map((field) => [field, properties[field]])),
      idHex: dontCare ? context.message?.idHex ?? formatHex(rawId, 8) : formatHex(rawId, extended ? 8 : 3),
      senders: [...properties.senders],
      receivers: [...properties.receivers],
      color: context.message?.protocol === properties.protocol
        ? context.message.color
        : CanMessage.colorForProtocol(properties.protocol),
      j1939,
    },
    errors,
  };
}