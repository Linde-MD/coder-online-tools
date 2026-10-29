import { parsePropertyText, serializePropertyText } from './property-text-codec.js';
import { validateSignalLayout } from './signal-layout.js';

export const SIGNAL_PROPERTY_FIELDS = Object.freeze([
  'name', 'startBit', 'length', 'factor', 'offset', 'min', 'max', 'signed', 'unit', 'comment',
]);
export { PROPERTY_TEXT_MAX_BYTES as SIGNAL_TEXT_MAX_BYTES } from './property-text-codec.js';

export function serializeSignalProperties(signal, format = 'json') {
  const properties = Object.fromEntries(SIGNAL_PROPERTY_FIELDS.map((field) => [field, signal[field]]));
  properties.min ??= null;
  properties.max ??= null;
  return serializePropertyText(properties, format);
}

export function parseSignalProperties(text, message, format = 'json') {
  const parsed = parsePropertyText(text, format, 'Signal');
  if (parsed.errors.length) return parsed;
  const errors = [];
  const invalid = () => ({ value: null, errors });
  const properties = { min: null, max: null, ...parsed.value };
  for (const field of SIGNAL_PROPERTY_FIELDS) {
    if (!Object.hasOwn(properties, field)) errors.push(`缺少必要字段：${field}。`);
  }
  for (const field of Object.keys(properties)) {
    if (!SIGNAL_PROPERTY_FIELDS.includes(field)) errors.push(`无法识别的字段：${field}。`);
  }
  if (errors.length) return invalid();

  if (typeof properties.name !== 'string' || !properties.name.trim()) {
    errors.push('name 必须是非空字符串。');
  }
  for (const field of ['unit', 'comment']) {
    if (typeof properties[field] !== 'string') errors.push(`${field} 必须是字符串。`);
  }
  for (const field of ['factor', 'offset']) {
    if (!Number.isFinite(properties[field])) errors.push(`${field} 必须是有限数值。`);
  }
  for (const field of ['min', 'max']) {
    if (properties[field] !== null && !Number.isFinite(properties[field])) {
      errors.push(`${field} 必须是有限数值或 null。`);
    }
  }
  if (Number.isFinite(properties.min) && Number.isFinite(properties.max) && properties.min > properties.max) {
    errors.push('min 不能大于 max。');
  }
  if (typeof properties.signed !== 'boolean') errors.push('signed 必须是布尔值 true 或 false。');

  const layout = validateSignalLayout(properties, message);
  errors.push(...[layout.messageError, layout.startBitError, layout.lengthError].filter(Boolean));
  if (errors.length) return invalid();

  return {
    value: Object.fromEntries(SIGNAL_PROPERTY_FIELDS.map((field) => [field, properties[field]])),
    errors,
  };
}