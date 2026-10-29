import { isAlias, parseDocument, stringify, visit } from 'yaml';
import { validateSignalLayout } from './signal-layout.js';

export const SIGNAL_PROPERTY_FIELDS = Object.freeze([
  'name', 'startBit', 'length', 'factor', 'offset', 'min', 'max', 'signed', 'unit', 'comment',
]);
export const SIGNAL_TEXT_MAX_BYTES = 64 * 1024;

export function serializeSignalProperties(signal, format = 'json') {
  const properties = Object.fromEntries(SIGNAL_PROPERTY_FIELDS.map((field) => [field, signal[field]]));
  properties.min ??= null;
  properties.max ??= null;
  if (format === 'yaml') {
    return stringify(properties, { version: '1.2', schema: 'core', lineWidth: 0, blockQuote: 'literal' });
  }
  if (format !== 'json') throw new Error(`不支持的文本格式：${format}。`);
  return `${JSON.stringify(properties, null, 2)}\n`;
}

export function parseSignalProperties(text, message, format = 'json') {
  const errors = [];
  const invalid = () => ({ value: null, errors });
  if (format !== 'json' && format !== 'yaml') {
    errors.push(`不支持的文本格式：${format}。`);
    return invalid();
  }
  if (new TextEncoder().encode(text).length > SIGNAL_TEXT_MAX_BYTES) {
    errors.push('文本不能超过 64 KiB。');
    return invalid();
  }

  let properties;
  try {
    if (format === 'yaml') {
      const document = parseDocument(text, {
        version: '1.2', schema: 'core', strict: true, uniqueKeys: true, customTags: [], merge: false,
      });
      errors.push(...[...document.errors, ...document.warnings].map((error) => `YAML 语法错误：${error.message}`));
      if (document.directives.yaml.version !== '1.2') errors.push('仅支持 YAML 1.2。');
      visit(document, (_key, node) => {
        if (isAlias(node) || node?.anchor || node?.tag) {
          errors.push('YAML 不支持显式标签、锚点或别名。');
          return visit.BREAK;
        }
      });
      if (errors.length) return invalid();
      properties = document.toJS({ maxAliasCount: 0 });
    } else {
      properties = JSON.parse(text);
    }
  } catch (error) {
    errors.push(`${format.toUpperCase()} 语法错误：${error.message}`);
    return invalid();
  }
  if (properties === null || typeof properties !== 'object' || Array.isArray(properties)) {
    errors.push('文本必须是一个 Signal 属性对象。');
    return invalid();
  }

  properties = { min: null, max: null, ...properties };
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