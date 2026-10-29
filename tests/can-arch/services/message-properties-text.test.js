import { describe, expect, it } from 'vitest';
import { CanMessage } from '../../../src/features/can-arch/domain/models/CanMessage.js';
import { encodeJ1939IdFromPgn } from '../../../src/shared/utils/j1939.js';
import { serializePropertyText } from '../../../src/features/can-arch/services/property-text-codec.js';
import {
  captureMessageProperties, MESSAGE_PROPERTY_FIELDS, parseMessageProperties, serializeMessageProperties,
} from '../../../src/features/can-arch/services/message-properties-text.js';

const message = new CanMessage({ id: 'message-1', name: 'MSG_1', senders: ['ecu-1'], receivers: ['ecu-2'] });
const context = {
  message, currentEcuId: 'ecu-1', pane: 'tx',
  participants: [
    { id: 'ecu-1', name: 'ECU_A', protocols: ['j1939'], j1939Addresses: [131] },
    { id: 'ecu-2', name: 'ECU_B', protocols: ['j1939'], j1939Addresses: [39] },
  ],
};
const properties = JSON.parse(serializeMessageProperties(message, 'json', context.participants));

describe('Message generated ID display', () => {
  it.each([
    { source: '0x000', decimal: 0, hexadecimal: '0x0' },
    { source: '0x123', decimal: 291, hexadecimal: '0x123' },
    { source: '0x7FF', decimal: 2047, hexadecimal: '0x7ff' },
    { source: '0x1FFFFFFF', decimal: 536870911, hexadecimal: '0x1fffffff' },
  ])('generates YAML hex and JSON decimal for $source', ({ source, decimal, hexadecimal }) => {
    const parent = { ...message, idHex: source, protocol: 'generic_ext' };
    const yaml = serializeMessageProperties(parent, 'yaml', context.participants);
    const json = serializeMessageProperties(parent, 'json', context.participants);
    expect(yaml).toContain(`\nid: ${hexadecimal}\n`);
    expect(yaml).toContain('\nperiodMs: 100\n');
    expect(yaml).toContain('\ndlc: 8\n');
    expect(JSON.parse(json).id).toBe(decimal);
    expect(json).toContain(`"id": ${decimal}`);
    expect(json).not.toContain('0x');
    expect(parseMessageProperties(yaml, { ...context, message: parent }, 'yaml').value.idHex)
      .toBe(`0x${decimal.toString(16).toUpperCase().padStart(8, '0')}`);
  });
});

describe.each(['json', 'yaml'])('Message %s property text', (format) => {
  const parse = (overrides = {}, options = {}) => parseMessageProperties(
    serializePropertyText({ ...properties, ...overrides }, format), { ...context, ...options }, format,
  );

  it('round-trips editable fields but excludes internal state and child signals', () => {
    const text = serializeMessageProperties(message, format, context.participants);
    expect(text).not.toContain('message-1');
    expect(text).not.toContain('signals');
    expect(text).not.toContain('triggerMode');
    expect(text).not.toContain('color');
    expect(text).not.toContain('idHex');
    expect(text).not.toContain('ecu-1');
    expect(text).toContain('ECU_A');
    expect(properties.id).toBe(0);
    expect(parseMessageProperties(text, context, format).errors).toEqual([]);
  });

  it.each(MESSAGE_PROPERTY_FIELDS)('requires %s', (field) => {
    const value = { ...properties };
    delete value[field];
    expect(parseMessageProperties(serializePropertyText(value, format), context, format).value).toBeNull();
  });

  it.each(['idHex', 'signals', 'color', 'unknown', '__proto__'])('rejects unknown field %s', (field) => {
    const value = { ...properties };
    Object.defineProperty(value, field, { value: 'unexpected', enumerable: true });
    expect(parseMessageProperties(serializePropertyText(value, format), context, format).errors).toContain(`无法识别的字段：${field}。`);
  });

  it.each([
    { name: '' }, { name: 1 }, { protocol: 'bad' }, { txMode: 'bad' },
    { byteOrder: 'bad' }, { dlcMode: 'bad' }, { receiverMode: 'bad' },
    { dlc: -1 }, { dlc: 65 }, { dlc: 1.5 }, { dlc: '8' },
    { periodMs: -1 }, { periodMs: null }, { periodMs: '100' },
    { id: 0x800 }, { id: -1 }, { id: 1.5 }, { id: '0x7FF' }, { id: null },
    { senders: ['missing'] }, { senders: [] }, { senders: ['ECU_A', 'ECU_A'] },
    { senders: {} }, { receivers: [] }, { receivers: [1] }, { comment: null },
    { receiverMode: 'broadcast' }, { senders: ['ECU_B'] },
  ])('rejects invalid properties %j', (overrides) => {
    expect(parse(overrides).value).toBeNull();
  });

  it('supports event and mixed modes, broadcast, extended IDs and variable DLC', () => {
    expect(parse({ txMode: 'event', periodMs: null }).errors).toEqual([]);
    expect(parse({ txMode: 'event', periodMs: 100 }).value).toBeNull();
    expect(parse({ txMode: 'mixed', periodMs: 0 }).errors).toEqual([]);
    expect(parse({ receiverMode: 'broadcast', receivers: [] }).errors).toEqual([]);
    expect(parse({ protocol: 'generic_ext', id: 0x1FFFFFFF, dlc: 64, dlcMode: 'variable' }).errors).toEqual([]);
  });

  it('keeps the first sender as default and requires the current RX receiver', () => {
    expect(parse({ senders: ['ECU_B', 'ECU_A'] }).value.senders).toEqual(['ecu-2', 'ecu-1']);
    expect(parse({}, { pane: 'rx', currentEcuId: 'ecu-2' }).errors).toEqual([]);
    expect(parse({}, { pane: 'rx', currentEcuId: 'ecu-1' }).value).toBeNull();
  });

  it('rejects DLC and byte-order changes that invalidate child signals', () => {
    const parent = { ...message, signals: [{ id: 'sig-1', name: 'SIG_1', startBit: 56, length: 8 }] };
    expect(parse({ dlc: 7 }, { message: parent }).errors.join('')).toContain('Signal SIG_1');
    expect(parse({ dlc: 8 }, { message: parent }).errors).toEqual([]);
    parent.signals[0] = { startBit: 7, length: 2 };
    expect(parse({ byteOrder: 'motorola' }, { message: parent }).value).toBeNull();
  });

  it('validates J1939 ID consistency, participant addresses and unknown nested fields', () => {
    const encoded = encodeJ1939IdFromPgn(0xFEEF, 6, 131, 0);
    const valid = { protocol: 'j1939', id: encoded.id, j1939: { pgn: '0xFEEF', priority: 6, sa: 131, da: 'broadcast' } };
    expect(parse(valid).errors).toEqual([]);
    expect(parse({ ...valid, id: 0 }).errors.join('')).toContain('ID 不一致');
    expect(parse({ ...valid, j1939: { ...valid.j1939, priority: 'dont_care' }, id: 0 }).errors).toEqual([]);
    expect(parse({ ...valid, j1939: { ...valid.j1939, extra: 1 } }).value).toBeNull();
    expect(parse({ ...valid, j1939: { ...valid.j1939, pgn: 0xE101 } }).value).toBeNull();
    expect(parse(valid, { participants: [{ id: 'ecu-1' }, { id: 'ecu-2' }] }).value).toBeNull();
  });

  it('supports addressed PDU1 J1939 and rejects invalid PGN, priority and DA', () => {
    const encoded = encodeJ1939IdFromPgn(0xE100, 6, 131, 39);
    const valid = { protocol: 'j1939', id: encoded.id, j1939: { pgn: 0xE100, priority: 6, sa: 131, da: 39 } };
    expect(parse(valid).errors).toEqual([]);
    for (const override of [
      { pgn: -1 }, { priority: 8 }, { sa: 256 }, { da: 256 }, { da: 40 },
      { sa: [131] }, { pgn: {} }, { sa: { toString: 'invalid' } }, { priority: { toString: null } },
    ]) {
      expect(parse({ ...valid, j1939: { ...valid.j1939, ...override } }).value).toBeNull();
    }
  });

  it('does not modify the source message during parsing', () => {
    const before = serializeMessageProperties(message);
    parse({ name: 'DRAFT' });
    expect(serializeMessageProperties(message)).toBe(before);
  });

  it('preserves an existing color unless the protocol changes', () => {
    const parent = { ...message, color: '#123456' };
    expect(parse({ name: 'RENAMED' }, { message: parent }).value.color).toBe('#123456');
    expect(parse({ protocol: 'generic_ext' }, { message: parent }).value.color).toBe(CanMessage.colorForProtocol('generic_ext'));
  });

  it('accepts decimal and hexadecimal numeric IDs without overwriting internal identity', () => {
    const text = serializePropertyText({ ...properties, id: 2047 }, format);
    const hexadecimal = format === 'json' ? text.replace('"id": 2047', '"id": 0x7FF') : text.replace('id: 2047', 'id: 0x7FF');
    for (const source of [text, hexadecimal]) {
      const result = parseMessageProperties(source, context, format);
      expect(result.errors).toEqual([]);
      expect(result.value.idHex).toBe('0x7FF');
      expect(result.value).not.toHaveProperty('id');
      expect(result.value.senders).toEqual(['ecu-1']);
      expect(result.value.receivers).toEqual(['ecu-2']);
    }
  });

  it('rejects ambiguous ECU names rather than guessing an internal ID', () => {
    const participants = [...context.participants, { id: 'ecu-3', name: 'ECU_A' }];
    expect(parse({}, { participants }).errors.join('')).toContain('重名');
  });

  it('does not expose missing node IDs as names', () => {
    const text = serializeMessageProperties({ ...message, senders: ['missing-hash'] }, format, context.participants);
    expect(text).not.toContain('missing-hash');
    expect(parseMessageProperties(text, context, format).value).toBeNull();
  });
});

it('captures only mutable message properties for rollback', () => {
  const snapshot = captureMessageProperties(message);
  expect(snapshot).not.toHaveProperty('signals');
  expect(snapshot).not.toHaveProperty('id');
  expect(snapshot.senders).not.toBe(message.senders);
  expect(snapshot.j1939).not.toBe(message.j1939);
  expect(snapshot.color).toBe(message.color);
});