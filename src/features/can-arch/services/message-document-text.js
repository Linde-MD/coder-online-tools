import JSON5 from 'json5';
import { captureMessageProperties, serializeMessageProperties, validateMessageProperties } from './message-properties-text.js';
import { parsePropertyText, serializePropertyText } from './property-text-codec.js';
import { serializeSignalProperties, validateSignalProperties } from './signal-properties-text.js';
import { validateSignalLayout } from './signal-layout.js';

export function serializeMessageDocument(message, format = 'json', participants = []) {
  return serializePropertyText({
    ...JSON.parse(serializeMessageProperties(message, 'json', participants)),
    signals: (message.signals || []).map((signal) => JSON.parse(serializeSignalProperties(signal))),
  }, format, { hexFields: ['id'] });
}

export function captureMessageDocument(message) {
  return { ...captureMessageProperties(message), signals: message.signals };
}

export function parseMessageDocument(text, context = {}, format = 'json') {
  const parsed = parsePropertyText(text, format, 'Message 完整', JSON5.parse);
  if (parsed.errors.length) return parsed;
  const { signals, ...properties } = parsed.value;
  if (!Array.isArray(signals)) return { value: null, errors: ['signals 必须是完整的 Signal 数组，不能省略。'] };
  if (signals.length > 512) return { value: null, errors: ['signals 最多包含 512 项。'] };
  const message = validateMessageProperties(properties, {
    ...context, message: { ...context.message, signals: [] },
  });
  if (message.errors.length) return message;

  const errors = [];
  const names = new Set();
  const bitOwners = new Map();
  const validated = [];
  for (let index = 0; index < signals.length; index += 1) {
    const signal = signals[index];
    const prefix = `signals[${index}]`;
    if (!signal || typeof signal !== 'object' || Array.isArray(signal)) {
      errors.push(`${prefix} 必须是 Signal 属性对象。`);
      continue;
    }
    const result = validateSignalProperties(signal, message.value);
    if (result.errors.length) {
      errors.push(...result.errors.map((error) => `${prefix}：${error}`));
      continue;
    }
    const value = result.value;
    if (names.has(value.name)) errors.push(`${prefix}：Signal 名称重复：${value.name}。`);
    names.add(value.name);
    const { bits } = validateSignalLayout(value, message.value);
    const overlap = bits.find((bit) => bitOwners.has(bit));
    if (overlap !== undefined) errors.push(`${prefix}：与 Signal ${bitOwners.get(overlap)} 存在位重叠（bit=${overlap}）。`);
    for (const bit of bits) {
      if (!bitOwners.has(bit)) bitOwners.set(bit, value.name);
    }
    validated.push(value);
  }
  if (errors.length) return { value: null, errors };

  const existingByName = new Map();
  for (const signal of context.message?.signals || []) {
    if (!existingByName.has(signal.name)) existingByName.set(signal.name, []);
    existingByName.get(signal.name).push(signal);
  }
  return {
    value: {
      ...message.value,
      signals: validated.map((signal) => {
        const matches = existingByName.get(signal.name) || [];
        return { ...signal, id: matches.length === 1 && matches[0].id ? matches[0].id : crypto.randomUUID() };
      }),
    },
    errors,
  };
}