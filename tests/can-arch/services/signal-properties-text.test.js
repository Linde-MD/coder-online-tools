import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import {
  parseSignalProperties,
  serializeSignalProperties,
  SIGNAL_PROPERTY_FIELDS,
} from '../../../src/features/can-arch/services/signal-properties-text.js';

const message = { dlc: 8, byteOrder: 'intel' };
const signal = {
  id: 'preserved-internal-id',
  name: '车速',
  startBit: 0,
  length: 8,
  factor: 1,
  offset: 0,
  min: null,
  max: null,
  signed: false,
  unit: 'km/h',
  comment: '第一行\n第二行："测试"',
};
const parse = (overrides = {}, parent = message) => parseSignalProperties(
  JSON.stringify({ ...JSON.parse(serializeSignalProperties(signal)), ...overrides }), parent,
);

describe('Signal property text', () => {
  it('round-trips all editable fields without exposing the internal ID', () => {
    const text = serializeSignalProperties(signal);
    expect(text).toContain('\n  "name"');
    expect(text).not.toContain('preserved-internal-id');
    const result = parseSignalProperties(text, message);
    expect(result.errors).toEqual([]);
    expect(Object.keys(result.value)).toEqual(SIGNAL_PROPERTY_FIELDS);
    expect(result.value.comment).toBe(signal.comment);
  });

  it.each(SIGNAL_PROPERTY_FIELDS.filter((field) => field !== 'min' && field !== 'max'))('requires field %s', (field) => {
    const data = JSON.parse(serializeSignalProperties(signal));
    delete data[field];
    expect(parseSignalProperties(JSON.stringify(data), message).errors).toContain(`缺少必要字段：${field}。`);
  });

  it.each([
    { fields: ['min'] }, { fields: ['max'] }, { fields: ['min', 'max'] },
  ])('accepts omitted optional physical bounds: $fields', ({ fields }) => {
    const data = { ...JSON.parse(serializeSignalProperties(signal)), min: 0, max: 255 };
    for (const field of fields) delete data[field];
    const result = parseSignalProperties(JSON.stringify(data), message);
    expect(result.errors).toEqual([]);
    expect(result.value.min).toBe(fields.includes('min') ? null : 0);
    expect(result.value.max).toBe(fields.includes('max') ? null : 255);
  });

  it('generates explicit null bounds when the source has missing or undefined bounds', () => {
    const source = { ...signal, max: undefined };
    delete source.min;
    const data = JSON.parse(serializeSignalProperties(source));
    expect(data).toMatchObject({ min: null, max: null });
    expect(parseSignalProperties(JSON.stringify(data), message).errors).toEqual([]);
  });

  it.each(['id', 'unknown', '__proto__', 'constructor'])('rejects unknown field %s', (field) => {
    const data = JSON.parse(serializeSignalProperties(signal));
    Object.defineProperty(data, field, { value: 'unexpected', enumerable: true });
    expect(parseSignalProperties(JSON.stringify(data), message).errors).toContain(`无法识别的字段：${field}。`);
  });

  it.each(['', '{', '{"name":}', '{"name":"x",}'])('rejects invalid JSON %s', (text) => {
    expect(parseSignalProperties(text, message).value).toBeNull();
    expect(parseSignalProperties(text, message).errors[0]).toContain('JSON 语法错误');
  });

  it.each(['null', '[]', '1', '"text"', 'true'])('rejects non-object JSON %s', (text) => {
    expect(parseSignalProperties(text, message).value).toBeNull();
  });

  it.each([
    { name: '' }, { name: '  ' }, { name: 123 }, { signed: 'false' },
    { factor: '1' }, { offset: null }, { min: '' }, { max: '10' },
    { unit: null }, { comment: {} }, { startBit: '0' }, { length: 1.5 },
    { startBit: -1 }, { length: 0 },
  ])('rejects invalid field types or values: %j', (overrides) => {
    expect(parse(overrides).value).toBeNull();
    expect(parse(overrides).errors.length).toBeGreaterThan(0);
  });

  it('rejects reversed physical bounds', () => {
    expect(parse({ min: 10, max: 1 }).errors).toContain('min 不能大于 max。');
  });

  it('accepts explicit physical bounds and false signed values', () => {
    expect(parse({ min: 0, max: 255, signed: false }).errors).toEqual([]);
  });

  it('validates the combined Intel bit range against the parent DLC', () => {
    expect(parse({ startBit: 60, length: 8 }).value).toBeNull();
    expect(parse({ startBit: 56, length: 8 }).errors).toEqual([]);
    expect(parse({ startBit: 56 }, { dlc: 7 }).value).toBeNull();
  });

  it('validates the current Motorola convention', () => {
    const parent = { dlc: 2, byteOrder: 'motorola' };
    expect(parse({ startBit: 7, length: 2 }, parent).value).toBeNull();
    expect(parse({ startBit: 8, length: 16 }, parent).errors).toEqual([]);
  });

  it('rejects non-finite numeric JSON values', () => {
    const text = serializeSignalProperties(signal).replace('"factor": 1', '"factor": 1e400');
    expect(parseSignalProperties(text, message).value).toBeNull();
  });

  it('rejects oversized text', () => {
    expect(parse({ comment: '字'.repeat(24000) }).errors).toContain('文本不能超过 64 KiB。');
  });

  it('does not mutate the source signal when parsing a draft', () => {
    const before = structuredClone(signal);
    parse({ name: '草稿' });
    expect(signal).toEqual(before);
  });
});

describe('Signal YAML property text', () => {
  const properties = JSON.parse(serializeSignalProperties(signal));
  const parseYaml = (overrides = {}, parent = message) => parseSignalProperties(
    stringify({ ...properties, ...overrides }), parent, 'yaml',
  );

  it('round-trips readable YAML and multiline comments without exposing the ID', () => {
    const text = serializeSignalProperties(signal, 'yaml');
    expect(text).toContain('name: 车速');
    expect(text).toContain('min: null');
    expect(text).toContain('max: null');
    expect(text).toContain('comment: |');
    expect(text).not.toContain('preserved-internal-id');
    expect(parseSignalProperties(text, message, 'yaml')).toEqual({ value: properties, errors: [] });
  });

  it('accepts comments and preserves quoted numeric-looking strings', () => {
    const text = serializeSignalProperties({ ...signal, name: '001', unit: 'false' }, 'yaml');
    const result = parseSignalProperties(`# Signal 属性\n${text}`, message, 'yaml');
    expect(result.errors).toEqual([]);
    expect(result.value).toMatchObject({ name: '001', unit: 'false' });
  });

  it.each(SIGNAL_PROPERTY_FIELDS.filter((field) => field !== 'min' && field !== 'max'))('requires field %s in YAML', (field) => {
    const data = { ...properties };
    delete data[field];
    expect(parseSignalProperties(stringify(data), message, 'yaml').errors).toContain(`缺少必要字段：${field}。`);
  });

  it.each([
    { fields: ['min'] }, { fields: ['max'] }, { fields: ['min', 'max'] },
  ])('accepts omitted optional YAML bounds: $fields', ({ fields }) => {
    const data = { ...properties };
    for (const field of fields) delete data[field];
    expect(parseSignalProperties(stringify(data), message, 'yaml')).toEqual({ value: properties, errors: [] });
  });

  it('rejects unknown fields in YAML', () => {
    expect(parseYaml({ unknown: 1 }).errors).toContain('无法识别的字段：unknown。');
  });

  it('rejects duplicate YAML keys', () => {
    const text = `${serializeSignalProperties(signal, 'yaml')}name: duplicate\n`;
    const result = parseSignalProperties(text, message, 'yaml');
    expect(result.value).toBeNull();
    expect(result.errors.join('')).toContain('unique');
  });

  it.each([
    'name: &value test\nunit: *value\n',
    'name: &value test\n',
    'name: !unsafe test\n',
    'name: !!str 123\n',
  ])('rejects explicit tags, anchors and aliases: %s', (text) => {
    const result = parseSignalProperties(text, message, 'yaml');
    expect(result.value).toBeNull();
    expect(result.errors.join('')).toContain('标签、锚点或别名');
  });

  it('rejects multiple YAML documents', () => {
    const text = `${serializeSignalProperties(signal, 'yaml')}---\nname: second\n`;
    expect(parseSignalProperties(text, message, 'yaml').value).toBeNull();
  });

  it('rejects a YAML 1.1 directive', () => {
    const text = `%YAML 1.1\n---\n${serializeSignalProperties(signal, 'yaml')}`;
    expect(parseSignalProperties(text, message, 'yaml').errors).toContain('仅支持 YAML 1.2。');
  });

  it.each(['name: [', 'name: test\n  length: 8\n', '- name: test', 'null'])('rejects invalid YAML syntax or roots: %s', (text) => {
    expect(parseSignalProperties(text, message, 'yaml').value).toBeNull();
  });

  it.each([
    { signed: 'false' }, { factor: Infinity }, { offset: NaN }, { min: '' },
    { max: '10' }, { unit: 123 }, { comment: ['text'] }, { length: 1.5 },
    { startBit: -1 }, { length: 0 }, { min: 10, max: 1 },
  ])('applies the same type and range checks to YAML: %j', (overrides) => {
    expect(parseYaml(overrides).value).toBeNull();
  });

  it('validates Intel and Motorola ranges in YAML', () => {
    expect(parseYaml({ startBit: 60, length: 8 }).value).toBeNull();
    expect(parseYaml({ startBit: 56, length: 8 }).errors).toEqual([]);
    expect(parseYaml({ startBit: 7, length: 2 }, { dlc: 2, byteOrder: 'motorola' }).value).toBeNull();
    expect(parseYaml({ startBit: 8, length: 16 }, { dlc: 2, byteOrder: 'motorola' }).errors).toEqual([]);
  });

  it('enforces the text size limit for YAML', () => {
    expect(parseYaml({ comment: '字'.repeat(24000) }).errors).toContain('文本不能超过 64 KiB。');
  });

  it('does not change JSON mode parsing rules', () => {
    expect(parseSignalProperties(serializeSignalProperties(signal, 'yaml'), message).value).toBeNull();
    expect(parseSignalProperties(serializeSignalProperties(signal), message).errors).toEqual([]);
  });
});