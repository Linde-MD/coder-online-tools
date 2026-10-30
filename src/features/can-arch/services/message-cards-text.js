import JSON5 from 'json5';
import { CanMessage } from '../domain/models/CanMessage.js';
import { parsePropertyText, serializePropertyText } from './property-text-codec.js';
import { parseMessageDocument, serializeMessageDocument } from './message-document-text.js';

export const MAX_MESSAGES_PER_PANE = 512;

export function serializeMessageCards(messages, format = 'json', participants = []) {
  const documents = (Array.isArray(messages) ? messages : []).map((message) => (
    JSON.parse(serializeMessageDocument(message, 'json', participants))
  ));
  return serializePropertyText({ messages: documents }, format, { hexFields: ['messages[].id'] });
}

export function captureMessageCards(entity) {
  return [...entity.messages];
}

function matchExistingMessage(document, index, existing, claimed) {
  const candidates = existing.map((message, candidateIndex) => ({ message, candidateIndex }))
    .filter(({ message, candidateIndex }) => !claimed.has(candidateIndex) && message.name === document.name);
  const samePosition = candidates.find(({ candidateIndex }) => candidateIndex === index);
  if (samePosition) return samePosition;
  if (candidates.length === 1) return candidates[0];
  if (!candidates.length && existing[index] && !claimed.has(index)) {
    return { message: existing[index], candidateIndex: index };
  }
  return null;
}

function formatMessageErrorPrefix(document, index) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return `messages[${index}]（名称未知，ID 未知）`;
  }
  const name = typeof document.name === 'string' && document.name.trim()
    ? document.name.trim().replace(/\s+/g, ' ').slice(0, 48)
    : '名称未知';
  const id = typeof document.id === 'number' && Number.isInteger(document.id) && document.id >= 0
    ? `0x${document.id.toString(16).toUpperCase()}`
    : document.id === undefined ? '未知'
      : typeof document.id === 'string' ? `无效值「${document.id.slice(0, 32)}」`
        : String(document.id);
  return `messages[${index}]（${name}，ID ${id}）`;
}

export function parseMessageCards(text, context = {}, format = 'json') {
  const parsed = parsePropertyText(text, format, '报文列表', JSON5.parse);
  if (parsed.errors.length) return parsed;
  const errors = [];
  const invalid = () => ({ value: null, errors });
  for (const field of Object.keys(parsed.value)) {
    if (field !== 'messages') errors.push(`无法识别的字段：${field}。`);
  }
  if (!Object.hasOwn(parsed.value, 'messages')) errors.push('缺少必要字段：messages。');
  if (errors.length) return invalid();
  if (!Array.isArray(parsed.value.messages)) return { value: null, errors: ['messages 必须是报文对象数组。'] };
  if (parsed.value.messages.length > MAX_MESSAGES_PER_PANE) {
    return { value: null, errors: [`每个 BUS 分栏最多包含 ${MAX_MESSAGES_PER_PANE} 条 Message。`] };
  }

  const existing = Array.isArray(context.messages) ? context.messages : [];
  const claimed = new Set();
  const messages = [];
  for (let index = 0; index < parsed.value.messages.length; index += 1) {
    const document = parsed.value.messages[index];
    if (!document || typeof document !== 'object' || Array.isArray(document)) {
      errors.push(`${formatMessageErrorPrefix(document, index)}：必须是完整的 Message 对象。`);
      continue;
    }
    const errorPrefix = formatMessageErrorPrefix(document, index);
    const match = matchExistingMessage(document, index, existing, claimed);
    if (match) claimed.add(match.candidateIndex);
    const result = parseMessageDocument(serializePropertyText(document, format, { hexFields: ['id'] }), {
      ...context,
      message: match?.message || { signals: [] },
    }, format);
    if (result.errors.length) {
      errors.push(...result.errors.map((error) => `${errorPrefix}：${error}`));
      continue;
    }
    messages.push(new CanMessage({
      ...result.value,
      id: match?.message.id || crypto.randomUUID(),
    }, context.currentEcuId, []));
  }
  if (errors.length) return invalid();
  return { value: { messages }, errors };
}