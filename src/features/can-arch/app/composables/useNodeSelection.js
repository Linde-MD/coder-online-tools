import { computed, ref } from 'vue';

export function useNodeSelection({ nodes, syncDraftFromSelected, defaultBaseColor }) {
  const selectedIds = ref([]);
  const selectedId = ref('');

  const selectedIdSet = computed(() => new Set(selectedIds.value));

  const selectedNodes = computed(() => {
    const ids = selectedIdSet.value;
    if (ids.size === 0) return [];
    return nodes.value.filter((n) => ids.has(n.id));
  });

  const selectedNode = computed(() => {
    if (!selectedId.value) return null;
    return nodes.value.find((n) => n.id === selectedId.value) ?? null;
  });

  const firstSelectedNode = computed(() => selectedNodes.value[0] ?? null);

  function setSelection(ids, options = {}) {
    const idSet = new Set(nodes.value.map((item) => item.id));
    const normalized = [...new Set(Array.isArray(ids) ? ids : [])].filter((id) => idSet.has(id));
    selectedIds.value = normalized;
    selectedId.value = normalized.length === 1 ? normalized[0] : '';
    if (options.sync !== false) {
      syncDraftFromSelected();
    }
  }

  function clearSelection(options = {}) {
    setSelection([], options);
  }

  function addSelected(id, options = {}) {
    setSelection([...new Set([...selectedIds.value, id])], options);
  }

  function removeSelected(id, options = {}) {
    setSelection(selectedIds.value.filter((x) => x !== id), options);
  }

  function toggleSelected(id, additive = false) {
    if (additive) {
      if (selectedIds.value.includes(id)) {
        removeSelected(id);
      } else {
        addSelected(id);
      }
      return;
    }
    setSelection([id]);
  }

  function isSelected(id) {
    return selectedIdSet.value.has(id);
  }

  const selectionCount = computed(() => selectedIds.value.length);
  const hasSingleSelection = computed(() => selectionCount.value === 1);
  const hasSelection = computed(() => selectionCount.value > 0);

  return {
    selectedIds,
    selectedId,
    selectedIdSet,
    selectedNodes,
    selectedNode,
    firstSelectedNode,
    selectionCount,
    hasSingleSelection,
    hasSelection,
    setSelection,
    clearSelection,
    addSelected,
    removeSelected,
    toggleSelected,
    isSelected,
  };
}