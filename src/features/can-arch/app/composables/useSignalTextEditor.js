import { computed, reactive, ref, shallowRef, watch } from 'vue';
import { parseSignalProperties, serializeSignalProperties } from '../../services/signal-properties-text.js';

export function useSignalTextEditor({ signal, message, drafts, persistChanges, format = ref('json') }) {
  const draft = shallowRef(null);

  function synchronize(record, current) {
    const source = serializeSignalProperties(current, format.value);
    record.text = source;
    record.savedText = source;
    record.sourceSnapshot = serializeSignalProperties(current);
    record.notice = '';
    record.saveError = '';
  }

  watch([signal, format], ([current, currentFormat]) => {
    const source = serializeSignalProperties(current, currentFormat);
    const key = currentFormat === 'json' ? current.id : `${currentFormat}:${current.id}`;
    let record = drafts.get(key);
    if (!record) {
      record = reactive({
        text: source,
        savedText: source,
        sourceSnapshot: serializeSignalProperties(current),
        notice: '',
        saveError: '',
        saving: false,
        copying: false,
      });
      drafts.set(key, record);
    } else if (record.text === record.savedText && !record.saving) {
      synchronize(record, current);
    }
    draft.value = record;
  }, { immediate: true, flush: 'sync' });

  watch(() => serializeSignalProperties(signal.value), () => {
    const record = draft.value;
    if (!record.saving && record.text === record.savedText) synchronize(record, signal.value);
  }, { flush: 'sync' });

  watch(() => draft.value.text, () => {
    draft.value.notice = '';
    draft.value.saveError = '';
  }, { flush: 'sync' });

  const validation = computed(() => parseSignalProperties(draft.value.text, message.value, format.value));
  const dirty = computed(() => draft.value.text !== draft.value.savedText);
  const hasConflict = computed(() => !draft.value.saving
    && serializeSignalProperties(signal.value) !== draft.value.sourceSnapshot);
  const errors = computed(() => [
    ...validation.value.errors,
    ...(hasConflict.value ? ['Signal 已被其他操作修改，当前草稿无法保存。'] : []),
    ...(draft.value.saveError ? [draft.value.saveError] : []),
  ]);
  const canSave = computed(() => dirty.value && validation.value.value !== null
    && !hasConflict.value && !draft.value.saving);

  async function save() {
    if (!canSave.value) return false;
    const record = draft.value;
    const target = signal.value;
    const previous = JSON.parse(serializeSignalProperties(target));
    const properties = validation.value.value;
    const appliedSnapshot = serializeSignalProperties(properties);
    const submittedText = record.text;
    record.saving = true;
    record.saveError = '';
    record.notice = '';
    Object.assign(target, properties);
    try {
      if (await persistChanges() !== true) throw new Error('浏览器存储写入失败，请重试。');
      record.sourceSnapshot = appliedSnapshot;
      record.savedText = submittedText;
      record.notice = '已保存';
      return true;
    } catch (error) {
      if (serializeSignalProperties(target) === appliedSnapshot) Object.assign(target, previous);
      record.saveError = `保存失败：${error?.message || '浏览器存储不可用'}`;
      return false;
    } finally {
      record.saving = false;
    }
  }

  async function copy() {
    const record = draft.value;
    if (record.copying) return;
    record.copying = true;
    record.notice = '';
    record.saveError = '';
    try {
      if (!globalThis.navigator?.clipboard?.writeText) throw new Error('剪贴板不可用，请手动选择文本复制。');
      await globalThis.navigator.clipboard.writeText(record.text);
      record.notice = '已复制';
    } catch (error) {
      record.saveError = `复制失败：${error?.message || '剪贴板权限被拒绝'}`;
    } finally {
      record.copying = false;
    }
  }

  function reload() {
    if (!draft.value.saving) synchronize(draft.value, signal.value);
  }

  return { draft, dirty, errors, canSave, hasConflict, save, copy, reload };
}