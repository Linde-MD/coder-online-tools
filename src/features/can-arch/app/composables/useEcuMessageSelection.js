import { computed, reactive, ref } from 'vue';

export function useEcuMessageSelection({ getRowsByPane }) {
  const selectedPane = ref('rx');
  const selectedKeys = ref([]);
  const lastIndexByPane = reactive({ rx: -1, tx: -1 });

  const selectedEntity = computed(() => {
    const key = selectedKeys.value[0];
    if (!key) return null;
    const pane = key.startsWith('rx|') ? 'rx' : 'tx';
    const rows = getRowsByPane(pane);
    const row = rows.find((item) => item.key === key);
    if (!row) return null;
    return {
      pane,
      type: row.type,
      entity: row.type === 'message' ? row.message : row.signal,
      message: row.message,
    };
  });

  function clearSelection() {
    selectedKeys.value = [];
  }

  function ensureSelected(row, pane) {
    if (!row) return;
    selectedPane.value = pane;
    if (!selectedKeys.value.includes(row.key)) {
      selectedKeys.value = [row.key];
    }
  }

  function onRowClick(row, index, pane, event) {
    selectedPane.value = pane;
    const rows = getRowsByPane(pane);

    if (event.shiftKey && lastIndexByPane[pane] >= 0) {
      const start = Math.min(lastIndexByPane[pane], index);
      const end = Math.max(lastIndexByPane[pane], index);
      const keys = rows.slice(start, end + 1).map((item) => item.key);
      if (event.ctrlKey || event.metaKey) {
        selectedKeys.value = [...new Set([...selectedKeys.value, ...keys])];
      } else {
        selectedKeys.value = keys;
      }
    } else if (event.ctrlKey || event.metaKey) {
      if (selectedKeys.value.includes(row.key)) {
        selectedKeys.value = selectedKeys.value.filter((item) => item !== row.key);
      } else {
        selectedKeys.value = [...selectedKeys.value, row.key];
      }
    } else {
      selectedKeys.value = [row.key];
    }

    lastIndexByPane[pane] = index;
  }

  return {
    selectedPane,
    selectedKeys,
    selectedEntity,
    clearSelection,
    ensureSelected,
    onRowClick,
  };
}
