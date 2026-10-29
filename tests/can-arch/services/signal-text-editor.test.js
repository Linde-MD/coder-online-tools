import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';
import { useSignalTextEditor } from '../../../src/features/can-arch/app/composables/useSignalTextEditor.js';
import { usePropertyTextEditor } from '../../../src/features/can-arch/app/composables/usePropertyTextEditor.js';
import { CanMessage } from '../../../src/features/can-arch/domain/models/CanMessage.js';
import { captureMessageProperties, parseMessageProperties, serializeMessageProperties } from '../../../src/features/can-arch/services/message-properties-text.js';
import { serializePropertyText } from '../../../src/features/can-arch/services/property-text-codec.js';
import { serializeSignalProperties } from '../../../src/features/can-arch/services/signal-properties-text.js';

const scopes = [];
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop());
  vi.unstubAllGlobals();
});

function createEditor(persistChanges = vi.fn().mockResolvedValue(true)) {
  const signal = ref({
    id: 'signal-1', name: 'SIG_1', startBit: 0, length: 8, factor: 1, offset: 0,
    min: null, max: null, signed: false, unit: '', comment: '',
  });
  const message = ref({ dlc: 8, byteOrder: 'intel' });
  const format = ref('json');
  const drafts = new Map();
  const scope = effectScope();
  scopes.push(scope);
  const editor = scope.run(() => useSignalTextEditor({ signal, message, drafts, persistChanges, format }));
  function edit(properties) {
    editor.draft.value.text = JSON.stringify({ ...JSON.parse(editor.draft.value.text), ...properties }, null, 2);
  }
  return { ...editor, signal, message, format, drafts, persistChanges, edit };
}

describe('Signal text editor drafts', () => {
  it('does not save unchanged or invalid drafts', async () => {
    const editor = createEditor();
    expect(await editor.save()).toBe(false);
    editor.draft.value.text = '{';
    expect(await editor.save()).toBe(false);
    expect(editor.signal.value.name).toBe('SIG_1');
    expect(editor.persistChanges).not.toHaveBeenCalled();
  });

  it('saves validated changes and preserves the internal ID', async () => {
    const editor = createEditor();
    editor.edit({ name: '车速', signed: true });
    expect(editor.signal.value.name).toBe('SIG_1');
    expect(await editor.save()).toBe(true);
    expect(editor.signal.value).toMatchObject({ name: '车速', signed: true, id: 'signal-1' });
    expect(editor.persistChanges).toHaveBeenCalledTimes(1);
    expect(editor.dirty.value).toBe(false);
    expect(editor.draft.value.notice).toBe('已保存');
  });

  it('allows saving omitted min and max as unset physical bounds', async () => {
    const editor = createEditor();
    editor.signal.value.min = 0;
    editor.signal.value.max = 255;
    const properties = JSON.parse(editor.draft.value.text);
    delete properties.min;
    delete properties.max;
    editor.draft.value.text = JSON.stringify(properties);
    expect(editor.canSave.value).toBe(true);
    expect(await editor.save()).toBe(true);
    expect(editor.signal.value).toMatchObject({ min: null, max: null });
    expect(editor.persistChanges).toHaveBeenCalledTimes(1);
  });

  it.each([false, undefined])('rolls back failed persistence result %s and retains a retryable draft', async (result) => {
    const editor = createEditor(vi.fn().mockResolvedValue(result));
    editor.edit({ name: '未保存草稿' });
    expect(await editor.save()).toBe(false);
    expect(editor.signal.value.name).toBe('SIG_1');
    expect(editor.draft.value.text).toContain('未保存草稿');
    expect(editor.errors.value.join('')).toContain('保存失败');
    expect(editor.canSave.value).toBe(true);
  });

  it('retains the draft when persistence throws', async () => {
    const editor = createEditor(vi.fn().mockRejectedValue(new Error('quota exceeded')));
    editor.edit({ unit: 'km/h' });
    expect(await editor.save()).toBe(false);
    expect(editor.signal.value.unit).toBe('');
    expect(editor.errors.value.join('')).toContain('quota exceeded');
  });

  it('restores unsaved drafts after switching signals', () => {
    const editor = createEditor();
    const original = editor.signal.value;
    editor.edit({ name: '保留草稿' });
    editor.signal.value = { ...original, id: 'signal-2', name: 'SIG_2' };
    expect(editor.draft.value.text).toContain('SIG_2');
    editor.signal.value = original;
    expect(editor.draft.value.text).toContain('保留草稿');
    expect(editor.signal.value.name).toBe('SIG_1');
  });

  it('refreshes a clean draft when form values change', () => {
    const editor = createEditor();
    editor.signal.value.unit = 'km/h';
    expect(editor.draft.value.text).toContain('km/h');
    expect(editor.dirty.value).toBe(false);
  });

  it('blocks stale drafts and explicitly reloads current properties', async () => {
    const editor = createEditor();
    editor.edit({ name: '旧草稿' });
    editor.signal.value.name = '表单新值';
    expect(editor.hasConflict.value).toBe(true);
    expect(await editor.save()).toBe(false);
    expect(editor.persistChanges).not.toHaveBeenCalled();
    editor.reload();
    expect(editor.draft.value.text).toBe(serializeSignalProperties(editor.signal.value));
    expect(editor.hasConflict.value).toBe(false);
  });

  it('revalidates when the parent message capacity changes', () => {
    const editor = createEditor();
    editor.edit({ startBit: 56 });
    expect(editor.canSave.value).toBe(true);
    editor.message.value.dlc = 7;
    expect(editor.canSave.value).toBe(false);
  });

  it('prevents duplicate saves while persistence is pending', async () => {
    let finish;
    const editor = createEditor(vi.fn(() => new Promise((resolve) => { finish = resolve; })));
    editor.edit({ name: '保存中' });
    const saving = editor.save();
    expect(editor.draft.value.saving).toBe(true);
    expect(await editor.save()).toBe(false);
    finish(true);
    expect(await saving).toBe(true);
    expect(editor.persistChanges).toHaveBeenCalledTimes(1);
  });

  it('does not undo concurrent source changes when persistence fails', async () => {
    let finish;
    const editor = createEditor(vi.fn(() => new Promise((resolve) => { finish = resolve; })));
    editor.edit({ name: '保存草稿' });
    const saving = editor.save();
    editor.signal.value.name = '并发修改';
    finish(false);
    await saving;
    expect(editor.signal.value.name).toBe('并发修改');
    expect(editor.hasConflict.value).toBe(true);
  });

  it('copies the current draft without saving it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const editor = createEditor();
    editor.edit({ name: '复制草稿' });
    await editor.copy();
    expect(writeText).toHaveBeenCalledWith(editor.draft.value.text);
    expect(editor.signal.value.name).toBe('SIG_1');
    expect(editor.draft.value.notice).toBe('已复制');
    expect(editor.persistChanges).not.toHaveBeenCalled();
  });

  it('reports clipboard failures without discarding the draft', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('permission denied')) } });
    const editor = createEditor();
    editor.edit({ name: '草稿' });
    await editor.copy();
    expect(editor.errors.value.join('')).toContain('复制失败');
    expect(editor.draft.value.text).toContain('草稿');
  });

  it('preserves independent JSON and YAML drafts even when either is invalid', () => {
    const editor = createEditor();
    editor.draft.value.text = '{ invalid JSON';
    editor.format.value = 'yaml';
    expect(editor.draft.value.text).toContain('name: SIG_1');
    expect(editor.errors.value).toEqual([]);
    editor.draft.value.text = 'name: [';
    editor.format.value = 'json';
    expect(editor.draft.value.text).toBe('{ invalid JSON');
    editor.format.value = 'yaml';
    expect(editor.draft.value.text).toBe('name: [');
    expect(editor.canSave.value).toBe(false);
  });

  it('saves YAML without changing its comments or multiline draft text', async () => {
    const editor = createEditor();
    editor.format.value = 'yaml';
    const text = `# 草稿注释\n${serializeSignalProperties({ ...editor.signal.value, name: 'YAML_SIGNAL', comment: '第一行\n第二行' }, 'yaml')}`;
    editor.draft.value.text = text;
    expect(editor.hasConflict.value).toBe(false);
    expect(await editor.save()).toBe(true);
    expect(editor.signal.value).toMatchObject({ id: 'signal-1', name: 'YAML_SIGNAL', comment: '第一行\n第二行' });
    expect(editor.draft.value.text).toBe(text);
    expect(editor.dirty.value).toBe(false);
    expect(editor.hasConflict.value).toBe(false);
  });

  it('blocks an unsaved JSON draft from overwriting a saved YAML update', async () => {
    const editor = createEditor();
    editor.edit({ name: 'JSON 草稿' });
    const jsonDraft = editor.draft.value.text;
    editor.format.value = 'yaml';
    editor.draft.value.text = serializeSignalProperties({ ...editor.signal.value, unit: 'km/h' }, 'yaml');
    expect(await editor.save()).toBe(true);
    editor.format.value = 'json';
    expect(editor.draft.value.text).toBe(jsonDraft);
    expect(editor.hasConflict.value).toBe(true);
    expect(await editor.save()).toBe(false);
    editor.reload();
    expect(JSON.parse(editor.draft.value.text).unit).toBe('km/h');
    expect(editor.hasConflict.value).toBe(false);
  });

  it('refreshes an unchanged JSON view after a YAML save', async () => {
    const editor = createEditor();
    editor.format.value = 'yaml';
    editor.draft.value.text = serializeSignalProperties({ ...editor.signal.value, name: 'YAML_SAVED' }, 'yaml');
    expect(await editor.save()).toBe(true);
    editor.format.value = 'json';
    expect(JSON.parse(editor.draft.value.text).name).toBe('YAML_SAVED');
    expect(editor.dirty.value).toBe(false);
    expect(editor.errors.value).toEqual([]);
  });

  it('rolls back a failed YAML save and retains a retryable YAML draft', async () => {
    const editor = createEditor(vi.fn().mockResolvedValue(false));
    editor.format.value = 'yaml';
    editor.draft.value.text = serializeSignalProperties({ ...editor.signal.value, name: 'YAML 草稿' }, 'yaml');
    expect(await editor.save()).toBe(false);
    expect(editor.signal.value.name).toBe('SIG_1');
    expect(editor.draft.value.text).toContain('YAML 草稿');
    expect(editor.canSave.value).toBe(true);
    expect(editor.hasConflict.value).toBe(false);
  });
});

describe.each(['json', 'yaml'])('Message %s editor drafts', (currentFormat) => {
  function createMessageEditor(persistChanges = vi.fn().mockResolvedValue(true)) {
    const entity = ref(new CanMessage({
      id: 'message-1', name: 'MSG_1', senders: ['ecu-1'], receiverMode: 'broadcast',
      signals: [{ id: 'sig-1', name: 'SIG_1', startBit: 56, length: 8 }],
    }));
    const format = ref(currentFormat);
    const participants = [{ id: 'ecu-1', name: 'ECU_A' }];
    const scope = effectScope();
    scopes.push(scope);
    const editor = scope.run(() => usePropertyTextEditor({
      entity, format, drafts: new Map(), label: 'Message', persistChanges,
      serialize: (message, kind) => serializeMessageProperties(message, kind, participants), capture: captureMessageProperties,
      parse: (text, kind) => parseMessageProperties(text, {
        message: entity.value, participants, currentEcuId: 'ecu-1', pane: 'tx',
      }, kind),
    }));
    function edit(overrides) {
      editor.draft.value.text = serializePropertyText({
        ...JSON.parse(serializeMessageProperties(entity.value, 'json', participants)), ...overrides,
      }, format.value);
    }
    return { ...editor, entity, format, edit, persistChanges };
  }

  it('saves message properties while preserving the original child signal references', async () => {
    const editor = createMessageEditor();
    const signals = editor.entity.value.signals;
    const child = signals[0];
    editor.edit({ name: 'TEXT_MESSAGE', protocol: 'generic_ext', id: 0x1234 });
    expect(await editor.save()).toBe(true);
    expect(editor.entity.value.name).toBe('TEXT_MESSAGE');
    expect(editor.entity.value.id).toBe('message-1');
    expect(editor.entity.value.idHex).toBe('0x00001234');
    expect(editor.entity.value.senders).toEqual(['ecu-1']);
    expect(editor.entity.value.signals).toBe(signals);
    expect(editor.entity.value.signals[0]).toBe(child);
    expect(editor.entity.value.color).toBe(CanMessage.colorForProtocol('generic_ext'));
    expect(editor.hasConflict.value).toBe(false);
  });

  it('rolls back message metadata after a failed write and preserves child signals', async () => {
    const editor = createMessageEditor(vi.fn().mockResolvedValue(false));
    const before = captureMessageProperties(editor.entity.value);
    const signals = editor.entity.value.signals;
    editor.edit({ protocol: 'generic_ext', id: 0x1234 });
    expect(await editor.save()).toBe(false);
    expect(captureMessageProperties(editor.entity.value)).toEqual(before);
    expect(editor.entity.value.signals).toBe(signals);
    expect(editor.canSave.value).toBe(true);
  });

  it('blocks an edit that would overflow an existing signal', async () => {
    const editor = createMessageEditor();
    editor.edit({ dlc: 7 });
    expect(await editor.save()).toBe(false);
    expect(editor.persistChanges).not.toHaveBeenCalled();
    expect(editor.entity.value.dlc).toBe(8);
    expect(editor.errors.value.join('')).toContain('Signal SIG_1');
  });

  it('detects an intervening form edit instead of overwriting it', async () => {
    const editor = createMessageEditor();
    editor.edit({ name: 'TEXT_DRAFT' });
    editor.entity.value.name = 'FORM_EDIT';
    expect(await editor.save()).toBe(false);
    expect(editor.errors.value.join('')).toContain('Message 已被其他操作修改');
    expect(editor.entity.value.name).toBe('FORM_EDIT');
  });
});