import { Document, isAlias, isScalar, parseDocument, visit } from 'yaml';

export const PROPERTY_TEXT_MAX_BYTES = 64 * 1024;

export function serializePropertyText(properties, format = 'json', { hexFields = [] } = {}) {
  if (format === 'yaml') {
    const document = new Document(properties, { version: '1.2', schema: 'core' });
    for (const path of hexFields) {
      let nodes = [document];
      for (const [index, segment] of path.split('.').entries()) {
        const sequencePath = segment.endsWith('[]');
        const key = sequencePath ? segment.slice(0, -2) : segment;
        if (sequencePath) {
          nodes = nodes.flatMap((node) => {
            const sequence = node.get(key, true);
            return Array.isArray(sequence?.items) ? sequence.items : [];
          });
        } else if (index < path.split('.').length - 1) {
          nodes = nodes.map((node) => node.get(key, true)).filter(Boolean);
        } else {
          nodes = nodes.map((node) => node.get(key, true)).filter(Boolean);
        }
      }
      for (const scalar of nodes) {
        if (isScalar(scalar) && Number.isSafeInteger(scalar.value) && scalar.value >= 0) scalar.format = 'HEX';
      }
    }
    return document.toString({ lineWidth: 0, blockQuote: 'literal' });
  }
  if (format !== 'json') throw new Error(`不支持的文本格式：${format}。`);
  return `${JSON.stringify(properties, null, 2)}\n`;
}

export function parsePropertyText(text, format = 'json', label = 'Signal', parseJson = JSON.parse) {
  const errors = [];
  const invalid = () => ({ value: null, errors });
  if (format !== 'json' && format !== 'yaml') {
    errors.push(`不支持的文本格式：${format}。`);
    return invalid();
  }
  if (new TextEncoder().encode(text).length > PROPERTY_TEXT_MAX_BYTES) {
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
      properties = parseJson(text);
    }
  } catch (error) {
    errors.push(`${format.toUpperCase()} 语法错误：${error.message}`);
    return invalid();
  }
  if (properties === null || typeof properties !== 'object' || Array.isArray(properties)) {
    errors.push(`文本必须是一个 ${label} 属性对象。`);
    return invalid();
  }
  return { value: properties, errors };
}