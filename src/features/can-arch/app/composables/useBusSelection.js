import { computed } from 'vue';

export function useBusSelection({ buses, selectedBusIds, selectedBusId, syncBusDraftFromSelected }) {
  const selectedBusIdSet = computed(() => new Set(selectedBusIds.value));

  function setBusSelection(ids, options = {}) {
    const idSet = new Set(buses.value.map((item) => item.id));
    const normalized = [...new Set(Array.isArray(ids) ? ids : [])].filter((id) => idSet.has(id));
    selectedBusIds.value = normalized;
    selectedBusId.value = normalized.length === 1 ? normalized[0] : '';
    if (options.sync !== false) {
      syncBusDraftFromSelected();
    }
  }

  function clearBusSelection(options = {}) {
    setBusSelection([], options);
  }

  return {
    selectedBusIdSet,
    setBusSelection,
    clearBusSelection,
  };
}
