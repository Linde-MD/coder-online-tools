import { ref } from 'vue';
import {
  cloneTopologySnapshot,
  hydrateNodes,
  hydrateBuses,
  hydrateLinks,
} from '@/features/can-arch/domain/can-arch-topology.js';
import { HISTORY_LIMIT } from '@/features/can-arch/domain/can-arch-constants.js';

export function useHistoryManager({
  nodes,
  buses,
  links,
  selectedIds,
  clearBusSelection,
  selectedLinkId,
  syncDraftFromSelected,
  syncBusDraftFromSelected,
  persistNodes,
  setStatus,
  nextNodePosition,
  nextBusPosition,
}) {
  const historyPast = ref([]);
  const historyFuture = ref([]);
  const historySuspend = ref(false);

  const canUndo = () => historyPast.value.length > 0;
  const canRedo = () => historyFuture.value.length > 0;

  function takeTopologySnapshot() {
    return cloneTopologySnapshot({
      nodes: nodes.value,
      buses: buses.value,
      links: links.value,
    });
  }

  function pushHistorySnapshot() {
    if (historySuspend.value) return;
    historyPast.value.push(takeTopologySnapshot());
    if (historyPast.value.length > HISTORY_LIMIT) {
      historyPast.value.shift();
    }
    historyFuture.value = [];
  }

  function applyHistoryState(snapshot, statusText) {
    historySuspend.value = true;
    nodes.value = hydrateNodes(snapshot?.nodes || [], { nextNodePosition });
    buses.value = hydrateBuses(snapshot?.buses || [], { nextBusPosition });
    links.value = hydrateLinks(snapshot?.links || [], nodes.value, buses.value);
    selectedIds.value = [];
    clearBusSelection({ sync: false });
    selectedLinkId.value = '';
    syncDraftFromSelected();
    syncBusDraftFromSelected();
    persistNodes();
    historySuspend.value = false;
    setStatus(statusText);
  }

  function undoNodes() {
    if (historyPast.value.length === 0) return;
    const previous = historyPast.value.pop();
    historyFuture.value.push(takeTopologySnapshot());
    applyHistoryState(previous, '已撤销上一步操作。');
  }

  function redoNodes() {
    if (historyFuture.value.length === 0) return;
    const nextSnapshot = historyFuture.value.pop();
    historyPast.value.push(takeTopologySnapshot());
    applyHistoryState(nextSnapshot, '已重做上一步操作。');
  }

  return {
    historyPast,
    historyFuture,
    historySuspend,
    canUndo,
    canRedo,
    pushHistorySnapshot,
    takeTopologySnapshot,
    undoNodes,
    redoNodes,
  };
}