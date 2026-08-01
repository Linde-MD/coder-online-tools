import { computed, reactive, ref } from 'vue';

export function useDbcExportSelection() {
  const dbcExportModalOpen = ref(false);
  const dbcExportSelection = reactive({
    includeJ1939: true,
    includeOthers: true,
    j1939Mode: 'dedicated',
    selectedBusIds: [],
  });

  const pendingDbcExport = reactive({
    j1939Nodes: [],
    otherNodes: [],
    j1939Count: 0,
    otherCount: 0,
    busGroups: [],
  });

  const canConfirmDbcExport = computed(() => {
    if (pendingDbcExport.busGroups.length > 0) {
      const selectedGroups = pendingDbcExport.busGroups.filter((group) => group.selected);
      if (selectedGroups.length === 0) return false;
      return selectedGroups.every((group) => group.includeJ1939 || group.includeOthers);
    }

    const canUseJ1939 = pendingDbcExport.j1939Count > 0 && dbcExportSelection.includeJ1939;
    const canUseOthers = pendingDbcExport.otherCount > 0 && dbcExportSelection.includeOthers;
    return canUseJ1939 || canUseOthers;
  });

  function resetPendingDbcExport() {
    pendingDbcExport.j1939Nodes = [];
    pendingDbcExport.otherNodes = [];
    pendingDbcExport.j1939Count = 0;
    pendingDbcExport.otherCount = 0;
    pendingDbcExport.busGroups = [];
  }

  function closeDbcExportModal() {
    dbcExportModalOpen.value = false;
    dbcExportSelection.includeJ1939 = true;
    dbcExportSelection.includeOthers = true;
    dbcExportSelection.j1939Mode = 'dedicated';
    dbcExportSelection.selectedBusIds = [];
    resetPendingDbcExport();
  }

  function syncPendingDbcExportCountsByBusSelection() {
    if (pendingDbcExport.busGroups.length === 0) return;
    const j1939NodeIds = new Set();
    const otherNodeIds = new Set();
    for (const group of pendingDbcExport.busGroups) {
      if (!group.selected) continue;
      if (group.includeJ1939) {
        for (const node of group.j1939Nodes) {
          j1939NodeIds.add(node.id);
        }
      }
      if (group.includeOthers) {
        for (const node of group.otherNodes) {
          otherNodeIds.add(node.id);
        }
      }
    }
    pendingDbcExport.j1939Count = j1939NodeIds.size;
    pendingDbcExport.otherCount = otherNodeIds.size;
  }

  function toggleDbcExportBusSelection(busId, checked) {
    const group = pendingDbcExport.busGroups.find((item) => item.busId === busId);
    if (!group) return;
    group.selected = checked;
    if (!checked) {
      group.includeJ1939 = false;
      group.includeOthers = false;
    } else {
      group.includeJ1939 = group.hasJ1939;
      group.includeOthers = group.hasOthers;
    }
    syncPendingDbcExportCountsByBusSelection();
  }

  function toggleDbcExportGroupProtocol(busId, protocol, checked) {
    const group = pendingDbcExport.busGroups.find((item) => item.busId === busId);
    if (!group) return;
    if (!group.requiresProtocolSelection) return;
    if (protocol === 'j1939') {
      group.includeJ1939 = checked && group.hasJ1939;
    } else {
      group.includeOthers = checked && group.hasOthers;
    }
    syncPendingDbcExportCountsByBusSelection();
  }

  function updateDbcExportGroupJ1939Mode(busId, mode) {
    const group = pendingDbcExport.busGroups.find((item) => item.busId === busId);
    if (!group) return;
    group.j1939Mode = mode === 'downgrade' ? 'downgrade' : 'dedicated';
  }

  function openDbcExportForBusGroups(busGroups) {
    pendingDbcExport.busGroups = Array.isArray(busGroups) ? busGroups : [];
    pendingDbcExport.j1939Nodes = [];
    pendingDbcExport.otherNodes = [];
    dbcExportSelection.selectedBusIds = pendingDbcExport.busGroups.map((group) => group.busId);
    dbcExportSelection.includeJ1939 = true;
    dbcExportSelection.includeOthers = true;
    dbcExportSelection.j1939Mode = 'dedicated';
    syncPendingDbcExportCountsByBusSelection();
    dbcExportModalOpen.value = true;
  }

  function openDbcExportForProtocolSplit(j1939Nodes, otherNodes) {
    pendingDbcExport.busGroups = [];
    pendingDbcExport.j1939Nodes = Array.isArray(j1939Nodes) ? j1939Nodes : [];
    pendingDbcExport.otherNodes = Array.isArray(otherNodes) ? otherNodes : [];
    pendingDbcExport.j1939Count = pendingDbcExport.j1939Nodes.length;
    pendingDbcExport.otherCount = pendingDbcExport.otherNodes.length;
    dbcExportSelection.includeJ1939 = true;
    dbcExportSelection.includeOthers = true;
    dbcExportSelection.j1939Mode = 'dedicated';
    dbcExportModalOpen.value = true;
  }

  return {
    dbcExportModalOpen,
    dbcExportSelection,
    pendingDbcExport,
    canConfirmDbcExport,
    resetPendingDbcExport,
    closeDbcExportModal,
    syncPendingDbcExportCountsByBusSelection,
    toggleDbcExportBusSelection,
    toggleDbcExportGroupProtocol,
    updateDbcExportGroupJ1939Mode,
    openDbcExportForBusGroups,
    openDbcExportForProtocolSplit,
  };
}
