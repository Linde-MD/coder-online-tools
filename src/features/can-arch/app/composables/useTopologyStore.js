import { computed, ref } from 'vue';
import { HistoryManager } from '@/features/can-arch/infra/HistoryManager.js';
import { DexieRepository } from '@/features/can-arch/infra/DexieRepository.js';
import {
  cloneBusesSnapshot,
  cloneLinksSnapshot,
  cloneNodesSnapshot,
  cloneTopologySnapshot,
  extractTopologyFromConfigPayload,
  hydrateBuses,
  hydrateLinks,
  hydrateNodes,
} from '@/features/can-arch/domain/can-arch-topology.js';
import { HISTORY_LIMIT, STORAGE_KEY } from '@/features/can-arch/domain/can-arch-constants.js';

export function createTopologyStore({
  historyLimit = HISTORY_LIMIT,
  nextNodePosition,
  nextBusPosition,
  onStatus,
}) {
  const history = new HistoryManager(historyLimit);
  const repository = new DexieRepository(STORAGE_KEY);

  const nodes = ref([]);
  const buses = ref([]);
  const links = ref([]);

  const canUndo = computed(() => history.canUndo);
  const canRedo = computed(() => history.canRedo);

  function persist() {
    repository.save({
      nodes: cloneNodesSnapshot(nodes.value),
      buses: cloneBusesSnapshot(buses.value),
      links: cloneLinksSnapshot(links.value),
    }).catch((error) => onStatus?.(`架构保存失败：${error.message}`, true));
  }

  function takeSnapshot() {
    return cloneTopologySnapshot({
      nodes: nodes.value,
      buses: buses.value,
      links: links.value,
    });
  }

  function applyState(snapshotData, statusText) {
    nodes.value = hydrateNodes(snapshotData?.nodes || [], { nextNodePosition });
    buses.value = hydrateBuses(snapshotData?.buses || [], { nextBusPosition });
    links.value = hydrateLinks(snapshotData?.links || [], nodes.value, buses.value);
    persist();
    if (statusText && onStatus) onStatus(statusText);
  }

  function pushHistory() {
    history.snapshot(takeSnapshot);
  }

  function undo() {
    if (!history.canUndo) return;
    history.undo((prev) => {
      history.snapshot(takeSnapshot);
      applyState(prev, '已撤销上一步操作。');
      return null;
    });
  }

  function redo() {
    if (!history.canRedo) return;
    history.redo((next) => {
      history.snapshot(takeSnapshot);
      applyState(next, '已重做上一步操作。');
      return null;
    });
  }

  async function load() {
    const payload = await repository.load();
    if (!payload) return;
    nodes.value = hydrateNodes(payload.nodes || [], { nextNodePosition });
    buses.value = hydrateBuses(payload.buses || [], { nextBusPosition });
    links.value = hydrateLinks(payload.links || [], nodes.value, buses.value);
  }

  function resetHistory() {
    history.reset();
  }

  function applyConfigPayload(payload, { clearSelection, syncDrafts, closeContextMenu } = {}) {
    const incoming = extractTopologyFromConfigPayload(payload);
    pushHistory();
    nodes.value = hydrateNodes(incoming.nodes, { nextNodePosition });
    buses.value = hydrateBuses(incoming.buses, { nextBusPosition });
    links.value = hydrateLinks(incoming.links, nodes.value, buses.value);
    if (clearSelection) clearSelection();
    if (syncDrafts) syncDrafts();
    if (closeContextMenu) closeContextMenu();
    persist();
    if (onStatus) {
      onStatus(`已导入架构配置（${nodes.value.length} 个 ECU，${buses.value.length} 个 BUS）。`);
    }
  }

  return {
    nodes,
    buses,
    links,
    history,
    canUndo,
    canRedo,
    pushHistory,
    undo,
    redo,
    persist,
    load,
    resetHistory,
    takeSnapshot,
    applyConfigPayload,
  };
}