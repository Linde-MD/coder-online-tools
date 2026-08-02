import { computed, reactive, ref } from 'vue';

export function useDbcExportSelection() {
  const dbcExportModalOpen = ref(false);
  const dbcExportSelection = reactive({
    j1939Mode: 'dedicated',
    selectedBusIds: [],
  });

  const pendingDbcExport = reactive({
    originalNodes: [],
    j1939Nodes: [],
    otherNodes: [],
    originalNodeCount: 0,
    j1939Count: 0,
    otherCount: 0,
    busGroups: [],
  });

  const canConfirmDbcExport = computed(() => {
    if (pendingDbcExport.busGroups.length > 0) {
      return pendingDbcExport.busGroups.some((group) => group.selected);
    }
    return pendingDbcExport.originalNodeCount > 0;
  });

  function resetPendingDbcExport() {
    pendingDbcExport.originalNodes = [];
    pendingDbcExport.j1939Nodes = [];
    pendingDbcExport.otherNodes = [];
    pendingDbcExport.originalNodeCount = 0;
    pendingDbcExport.j1939Count = 0;
    pendingDbcExport.otherCount = 0;
    pendingDbcExport.busGroups = [];
  }

  function closeDbcExportModal() {
    dbcExportModalOpen.value = false;
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
      for (const node of group.j1939Nodes) {
        j1939NodeIds.add(node.id);
      }
      for (const node of group.otherNodes) {
        otherNodeIds.add(node.id);
      }
    }
    pendingDbcExport.j1939Count = j1939NodeIds.size;
    pendingDbcExport.otherCount = otherNodeIds.size;
  }

  function toggleDbcExportBusSelection(busId, checked) {
    const group = pendingDbcExport.busGroups.find((item) => item.busId === busId);
    if (!group) return;
    group.selected = checked;
    syncPendingDbcExportCountsByBusSelection();
  }

  function updateDbcExportGroupJ1939Mode(busId, mode) {
    const group = pendingDbcExport.busGroups.find((item) => item.busId === busId);
    if (!group) return;
    group.j1939Mode = mode === 'downgrade' ? 'downgrade' : 'dedicated';
  }

  function openDbcExportForBusGroups(busGroups) {
    pendingDbcExport.busGroups = Array.isArray(busGroups) ? busGroups : [];
    pendingDbcExport.originalNodes = [];
    pendingDbcExport.j1939Nodes = [];
    pendingDbcExport.otherNodes = [];
    dbcExportSelection.selectedBusIds = pendingDbcExport.busGroups.map((group) => group.busId);
    dbcExportSelection.j1939Mode = 'dedicated';
    syncPendingDbcExportCountsByBusSelection();
    dbcExportModalOpen.value = true;
  }

  function openDbcExportForProtocolSplit(originalNodes, j1939Nodes, otherNodes) {
    pendingDbcExport.busGroups = [];
    pendingDbcExport.originalNodes = Array.isArray(originalNodes) ? originalNodes : [];
    pendingDbcExport.j1939Nodes = Array.isArray(j1939Nodes) ? j1939Nodes : [];
    pendingDbcExport.otherNodes = Array.isArray(otherNodes) ? otherNodes : [];
    pendingDbcExport.originalNodeCount = new Set(pendingDbcExport.originalNodes.map((n) => n.id)).size;
    pendingDbcExport.j1939Count = pendingDbcExport.j1939Nodes.length;
    pendingDbcExport.otherCount = pendingDbcExport.otherNodes.length;
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
    updateDbcExportGroupJ1939Mode,
    openDbcExportForBusGroups,
    openDbcExportForProtocolSplit,
  };
}