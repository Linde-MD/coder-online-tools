import { describe, expect, it, vi } from 'vitest';
import { CanMessage } from '../../../src/features/can-arch/domain/models/CanMessage.js';
import { parseMessageCards, serializeMessageCards } from '../../../src/features/can-arch/services/message-cards-text.js';
import { serializePropertyText } from '../../../src/features/can-arch/services/property-text-codec.js';
import { usePropertyTextEditor } from '../../../src/features/can-arch/app/composables/usePropertyTextEditor.js';
import { effectScope, reactive, ref } from 'vue';

const participants = [{ id: 'ecu-1', name: 'ECU_A' }, { id: 'ecu-2', name: 'ECU_B' }];
const contextFor = (messages, pane = 'tx') => ({
  messages, participants, currentEcuId: 'ecu-1', pane,
});

function createMessages() {
  return [
    new CanMessage({
      id: 'message-1', name: 'MSG_1', idHex: '0x123', senders: ['ecu-1'], receiverMode: 'nodes', receivers: ['ecu-2'],
      signals: [{ id: 'signal-1', name: 'SIG_1', startBit: 0, length: 8 }],
    }),
    new CanMessage({
      id: 'message-2', name: 'MSG_2', idHex: '0x124', senders: ['ecu-1'], receiverMode: 'broadcast', receivers: [],
      signals: [],
    }),
  ];
}

describe.each(['json', 'yaml'])('Message cards %s', (format) => {
  it('round-trips the full pane with readable ECU names and numeric IDs', () => {
    const messages = createMessages();
    const text = serializeMessageCards(messages, format, participants);
    expect(text).not.toContain('message-1');
    expect(text).not.toContain('signal-1');
    expect(text).not.toContain('ecu-1');
    expect(text).toContain('ECU_A');
    if (format === 'yaml') expect(text).toContain('id: 0x123');
    const result = parseMessageCards(text, contextFor(messages), format);
    expect(result.errors).toEqual([]);
    expect(result.value.messages.map((message) => message.id)).toEqual(['message-1', 'message-2']);
    expect(result.value.messages[0].signals[0].id).toBe('signal-1');
  });

  it('preserves Message and Signal identities when messages are reordered', () => {
    const messages = createMessages();
    const value = JSON.parse(serializeMessageCards(messages, 'json', participants));
    value.messages.reverse();
    const result = parseMessageCards(JSON.stringify(value), contextFor(messages), format);
    expect(result.errors).toEqual([]);
    expect(result.value.messages.map((message) => message.id)).toEqual(['message-2', 'message-1']);
    expect(result.value.messages[1].signals[0].id).toBe('signal-1');
  });

  it('supports adding, removing, renaming and emptying the list', () => {
    const messages = createMessages();
    const value = JSON.parse(serializeMessageCards(messages, 'json', participants));
    value.messages[0].name = 'MSG_RENAMED';
    value.messages.push({ ...value.messages[1], name: 'MSG_NEW', id: 0x125 });
    value.messages.splice(1, 1);
    const result = parseMessageCards(JSON.stringify(value), contextFor(messages), format);
    expect(result.errors).toEqual([]);
    expect(result.value.messages.map((message) => message.name)).toEqual(['MSG_RENAMED', 'MSG_NEW']);
    expect(result.value.messages[0].id).toBe('message-1');
    expect(result.value.messages[1].id).toBe('message-2');
    expect(parseMessageCards('{"messages":[]}', contextFor(messages), format).value.messages).toEqual([]);
  });

  it.each([undefined, null, {}, 'invalid'])('rejects invalid messages list: %s', (messages) => {
    const value = messages === undefined ? '{}' : JSON.stringify({ messages });
    expect(parseMessageCards(value, contextFor(createMessages()), format).value).toBeNull();
  });

  it.each([null, [], 123, 'bad'])('rejects invalid list item: %s', (item) => {
    const result = parseMessageCards(JSON.stringify({ messages: [item] }), contextFor([]), format);
    expect(result.value).toBeNull();
    expect(result.errors[0]).toContain('messages[0]（名称未知，ID 未知）');
  });

  it('rejects a single invalid Message without partially returning the list', () => {
    const messages = createMessages();
    const value = JSON.parse(serializeMessageCards(messages, 'json', participants));
    value.messages[1].id = -1;
    const result = parseMessageCards(JSON.stringify(value), contextFor(messages), format);
    expect(result.value).toBeNull();
    expect(result.errors.join('')).toContain('messages[1]（MSG_2，ID -1）');
  });

  it('validates proposed Message properties against all its child signals', () => {
    const messages = createMessages();
    const value = JSON.parse(serializeMessageCards(messages, 'json', participants));
    value.messages[0].dlc = 0;
    const result = parseMessageCards(JSON.stringify(value), contextFor(messages), format);
    expect(result.value).toBeNull();
    expect(result.errors.join('')).toContain('messages[0]（MSG_1，ID 0x123）');
    expect(result.errors.join('')).toContain('signals[0]');
  });

  it('rejects list sizes over the safety limit', () => {
    expect(parseMessageCards(JSON.stringify({ messages: Array(513).fill({}) }), contextFor([]), format).errors.join(''))
      .toContain('最多包含 512');
  });

  it('applies the parsed list atomically and restores the original array after persistence fails', async () => {
    const messages = reactive(createMessages());
    const entity = ref({ id: 'tx:bus-1', messages });
    const drafts = new Map();
    const scope = effectScope();
    const persistChanges = vi.fn().mockResolvedValue(false);
    const editor = scope.run(() => usePropertyTextEditor({
      entity, drafts, label: '发送报文列表', format: ref(format),
      serialize: (value, kind) => serializeMessageCards(value.messages, kind, participants),
      parse: (text, kind) => parseMessageCards(text, contextFor(entity.value.messages), kind),
      capture: (value) => [...value.messages],
      apply: (target, value) => target.messages.splice(0, target.messages.length, ...value.messages),
      restore: (target, snapshot) => target.messages.splice(0, target.messages.length, ...snapshot),
      persistChanges,
    }));
    const initialIds = messages.map((message) => message.id);
    const changed = JSON.parse(serializeMessageCards(messages, 'json', participants));
    changed.messages[0].signals[0].unit = 'km/h';
    changed.messages[1].name = 'MSG_CHANGED';
    editor.draft.value.text = serializePropertyTextForTest(changed, format);
    expect(await editor.save()).toBe(false);
    expect(messages.map((message) => message.id)).toEqual(initialIds);
    expect(messages[0].signals[0].unit).toBe('');
    persistChanges.mockResolvedValue(true);
    expect(await editor.save()).toBe(true);
    expect(messages[0].signals[0].unit).toBe('km/h');
    expect(messages[1].name).toBe('MSG_CHANGED');
    expect(persistChanges).toHaveBeenCalledTimes(2);
    scope.stop();
  });
});

function serializePropertyTextForTest(value, format) {
  return serializePropertyText(value, format, { hexFields: ['messages[].id'] });
}