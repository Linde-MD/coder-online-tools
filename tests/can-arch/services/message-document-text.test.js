import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';
import { CanMessage } from '../../../src/features/can-arch/domain/models/CanMessage.js';
import { usePropertyTextEditor } from '../../../src/features/can-arch/app/composables/usePropertyTextEditor.js';
import { useEcuMessageCommands } from '../../../src/features/can-arch/app/composables/useEcuMessageCommands.js';
import { serializePropertyText } from '../../../src/features/can-arch/services/property-text-codec.js';
import { captureMessageDocument, parseMessageDocument, serializeMessageDocument } from '../../../src/features/can-arch/services/message-document-text.js';

const participants = [{ id: 'ecu-1', name: 'ECU_A' }];
function createMessage() {
  return new CanMessage({
    id: 'message-1', name: 'MSG_1', idHex: '0x123', senders: ['ecu-1'], receiverMode: 'broadcast',
    signals: [
      { id: 'signal-1', name: 'SIG_A', startBit: 0, length: 8 },
      { id: 'signal-2', name: 'SIG_B', startBit: 8, length: 8 },
    ],
  });
}
const contextFor = (message) => ({ message, participants, currentEcuId: 'ecu-1', pane: 'tx' });
const scopes = [];
afterEach(() => scopes.splice(0).forEach((scope) => scope.stop()));

describe('Complete Message context selection', () => {
  it('selects exactly the right-clicked Message even when another row was selected first', () => {
    const message = createMessage();
    const row = { key: 'tx|m|message-1', type: 'message', message };
    const selectedPane = ref('rx');
    const selectedKeys = ref(['tx|m|other', row.key]);
    const commands = useEcuMessageCommands({
      selectedPane, selectedKeys, getRowsByPane: (pane) => pane === 'tx' ? [row] : [],
      ensureSelected: vi.fn(),
    });
    commands.openRowContextMenu(row, 'tx', { clientX: 10, clientY: 20 });
    expect(commands.selectContextMessage()).toBe(message);
    expect(selectedPane.value).toBe('tx');
    expect(selectedKeys.value).toEqual([row.key]);
    expect(commands.contextMenu.open).toBe(false);
    commands.contextMenu.messageId = 'removed';
    expect(commands.selectContextMessage()).toBeNull();
  });
});

describe.each(['json', 'yaml'])('Complete Message %s text', (format) => {
  function setup() {
    const message = createMessage();
    const document = JSON.parse(serializeMessageDocument(message, 'json', participants));
    const parse = (value) => parseMessageDocument(serializePropertyText(value, format), contextFor(message), format);
    return { message, document, parse };
  }

  it('round-trips Message and all Signal fields while hiding internal IDs', () => {
    const { message } = setup();
    const text = serializeMessageDocument(message, format, participants);
    expect(text).not.toContain('message-1');
    expect(text).not.toContain('signal-1');
    expect(text).not.toContain('ecu-1');
    expect(text).toContain('ECU_A');
    if (format === 'yaml') expect(text).toContain('id: 0x123');
    const result = parseMessageDocument(text, contextFor(message), format);
    expect(result.errors).toEqual([]);
    expect(result.value.signals.map((signal) => signal.id)).toEqual(['signal-1', 'signal-2']);
    expect(result.value).not.toHaveProperty('id');
  });

  it('validates child signals against the proposed Message instead of the old payload', () => {
    const { message, document, parse } = setup();
    message.signals[0].startBit = 56;
    document.dlc = 2;
    document.signals[0].startBit = 0;
    expect(parse(document).errors).toEqual([]);
    document.signals[0].startBit = 16;
    expect(parse(document).errors.join('')).toContain('signals[0]');
  });

  it('supports adding, removing and reordering signals while preserving matching identities', () => {
    const { document, parse } = setup();
    document.signals = [document.signals[1], { ...document.signals[0], name: 'SIG_NEW', startBit: 16 }];
    const result = parse(document);
    expect(result.errors).toEqual([]);
    expect(result.value.signals[0].id).toBe('signal-2');
    expect(result.value.signals[1].id).toEqual(expect.any(String));
    expect(result.value.signals[1].id).not.toBe('signal-1');
    document.signals = [];
    expect(parse(document).value.signals).toEqual([]);
  });

  it.each([undefined, null, {}, 'invalid'])('rejects missing or malformed signals: %s', (signals) => {
    const { document, parse } = setup();
    document.signals = signals;
    expect(parse(document).value).toBeNull();
  });

  it.each([null, [], 123, 'invalid'])('rejects invalid signal entry: %s', (signal) => {
    const { document, parse } = setup();
    document.signals[0] = signal;
    expect(parse(document).errors.join('')).toContain('signals[0]');
  });

  it('rejects unknown fields and incomplete child properties', () => {
    const { document, parse } = setup();
    document.signals[0].unknown = true;
    expect(parse(document).errors.join('')).toContain('无法识别的字段');
    delete document.signals[0].unknown;
    delete document.signals[0].length;
    expect(parse(document).errors.join('')).toContain('缺少必要字段');
  });

  it('allows optional physical limits but rejects non-finite numbers', () => {
    const { document, parse } = setup();
    delete document.signals[0].min;
    delete document.signals[0].max;
    expect(parse(document).value.signals[0].min).toBeNull();
    document.signals[0].min = Infinity;
    const text = format === 'json'
      ? JSON.stringify(document).replace('"min":null', '"min":Infinity')
      : serializePropertyText(document, 'yaml');
    expect(parseMessageDocument(text, contextFor(createMessage()), format).value).toBeNull();
  });

  it('rejects duplicate names and overlapping bit layouts', () => {
    const { document, parse } = setup();
    document.signals[1].name = 'SIG_A';
    expect(parse(document).errors.join('')).toContain('名称重复');
    document.signals[1].name = 'SIG_B';
    document.signals[1].startBit = 4;
    expect(parse(document).errors.join('')).toContain('位重叠');
  });

  it('rejects invalid Message properties and oversized documents', () => {
    const { document, parse } = setup();
    document.senders = ['unknown'];
    expect(parse(document).value).toBeNull();
    document.senders = ['ECU_A'];
    document.comment = '字'.repeat(24000);
    expect(parse(document).errors).toContain('文本不能超过 64 KiB。');
  });

  it('does not modify the source while validating a draft', () => {
    const { message, document, parse } = setup();
    const before = serializeMessageDocument(message);
    document.name = 'DRAFT';
    document.signals = [];
    parse(document);
    expect(serializeMessageDocument(message)).toBe(before);
  });

  it('blocks stale complete drafts after a child Signal is edited elsewhere', async () => {
    const entity = ref(createMessage());
    const persistChanges = vi.fn().mockResolvedValue(true);
    const scope = effectScope();
    scopes.push(scope);
    const editor = scope.run(() => usePropertyTextEditor({
      entity, format: ref(format), drafts: new Map(), label: 'Message 完整', persistChanges,
      serialize: (message, kind) => serializeMessageDocument(message, kind, participants),
      capture: captureMessageDocument,
      parse: (text, kind) => parseMessageDocument(text, contextFor(entity.value), kind),
    }));
    const document = JSON.parse(serializeMessageDocument(entity.value, 'json', participants));
    document.name = 'STALE_DRAFT';
    editor.draft.value.text = serializePropertyText(document, format);
    entity.value.signals[0].unit = 'm/s';
    expect(editor.hasConflict.value).toBe(true);
    expect(await editor.save()).toBe(false);
    expect(persistChanges).not.toHaveBeenCalled();
    expect(entity.value.name).toBe('MSG_1');
    expect(entity.value.signals[0].unit).toBe('m/s');
  });

  it('saves the entire document once and restores the original Signal array on failure', async () => {
    const entity = ref(createMessage());
    const persistChanges = vi.fn().mockResolvedValue(false);
    const scope = effectScope();
    scopes.push(scope);
    const editor = scope.run(() => usePropertyTextEditor({
      entity, format: ref(format), drafts: new Map(), label: 'Message 完整', persistChanges,
      serialize: (message, kind) => serializeMessageDocument(message, kind, participants),
      capture: captureMessageDocument,
      parse: (text, kind) => parseMessageDocument(text, contextFor(entity.value), kind),
    }));
    const oldSignals = entity.value.signals;
    const document = JSON.parse(serializeMessageDocument(entity.value, 'json', participants));
    document.name = 'BULK_EDIT';
    document.signals[0].unit = 'km/h';
    editor.draft.value.text = serializePropertyText(document, format);
    expect(await editor.save()).toBe(false);
    expect(entity.value.name).toBe('MSG_1');
    expect(entity.value.signals).toBe(oldSignals);
    expect(entity.value.signals[0].unit).toBe('');
    expect(editor.canSave.value).toBe(true);
    persistChanges.mockResolvedValue(true);
    expect(await editor.save()).toBe(true);
    expect(entity.value.name).toBe('BULK_EDIT');
    expect(entity.value.id).toBe('message-1');
    expect(entity.value.signals[0]).toMatchObject({ id: 'signal-1', unit: 'km/h' });
    expect(persistChanges).toHaveBeenCalledTimes(2);
  });
});