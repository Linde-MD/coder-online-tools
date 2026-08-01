import { computed, reactive, ref, watch } from 'vue';
import {
  STORAGE_KEY,
  AUTO_SAVE_INTERVAL_MS,
  HISTORY_LIMIT,
  CONFIG_VERSION,
  CONFIG_SCHEMA,
} from '../domain/can-arch-constants.js';
import { CanArchitectureGraph, CanNode, CanBus } from '../domain/index.js';
import { HistoryManager, LocalStorageRepository } from '../infra/index.js';

const LEGACY_NODES_KEY = 'coderOnlineTools.canArch.nodes.v1';
const LEGACY_SETTINGS_KEY = 'coderOnlineTools.canArch.settings.v1';

function buildLegacyNodesRepo() {
  return new LocalStorageRepository(LEGACY_NODES_KEY, JSON, { suppressErrors: true });
}

function buildStorageRepo() {
  return new LocalStorageRepository(STORAGE_KEY, JSON, {
    compatKeys: [LEGACY_SETTINGS_KEY, LEGACY_NODES_KEY],
    suppressErrors: true,
  });
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeSnapshotForRestore(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (Array.isArray(payload.nodes)) {
    return {
      nodes: payload.nodes,
      buses: Array.isArray(payload.buses) ? payload.buses : [],
      links: Array.isArray(payload.links) ? payload.links : [],
      config:
        typeof payload.config === 'object' && payload.config !== null
          ? payload.config
          : {
              linkStyle: payload.linkStyle || 'polyline',
              showGrid: payload.showGrid !== false,
              backgroundColor: payload.backgroundColor || '#fdfcf9',
              accentColor: payload.accentColor || '#16181b',
              gridSize: payload.gridSize || 20,
              autoSave: payload.autoSave !== false,
              showBusColors: payload.showBusColors !== false,
              showLegend: payload.showLegend !== false,
            },
    };
  }
  if (Array.isArray(payload)) {
    return { nodes: payload, buses: [], links: [], config: {} };
  }
  return null;
}

export function useCanArchitectureStore() {
  const storageRepo = buildStorageRepo();
  const legacyNodesRepo = buildLegacyNodesRepo();
  const history = new HistoryManager(HISTORY_LIMIT);

  const graph = reactive(new CanArchitectureGraph());

  const nodes = computed({
    get: () => graph.nodes,
    set: (value) => {
      graph.nodes.splice(0, graph.nodes.length, ...value);
    },
  });
  const buses = computed({
    get: () => graph.buses,
    set: (value) => {
      graph.buses.splice(0, graph.buses.length, ...value);
    },
  });
  const links = computed({
    get: () => graph.links,
    set: (value) => {
      graph.links.splice(0, graph.links.length, ...value);
    },
  });
  const appConfig = computed({
    get: () => graph.config,
    set: (value) => graph.updateConfig(value),
  });

  const statusText = ref('就绪');
  const statusError = ref('');
  const saveState = ref('saved');
  const autoSaveEnabled = computed(() => Boolean(appConfig.value.autoSave));
  const canUndo = ref(false);
  const canRedo = ref(false);

  let _autoSaveTimer = null;

  function setStatus(text, options = {}) {
    statusText.value = String(text || '');
    if (options.error) {
      statusError.value = String(options.error);
    } else if (options.clearError) {
      statusError.value = '';
    }
  }

  function markDirty() {
    saveState.value = 'dirty';
  }

  function _refreshHistoryFlags() {
    canUndo.value = history.canUndo;
    canRedo.value = history.canRedo;
  }

  function pushHistorySnapshot() {
    history.snapshot(() => graph.snapshot());
    _refreshHistoryFlags();
  }

  function undo() {
    const current = graph.snapshot();
    const ok = history.undo((prevSnapshot) => {
      graph.restore(prevSnapshot);
      return current;
    });
    if (ok) {
      markDirty();
      setStatus('已撤销上一步操作。', { clearError: true });
    }
    _refreshHistoryFlags();
    return ok;
  }

  function redo() {
    const current = graph.snapshot();
    const ok = history.redo((nextSnapshot) => {
      graph.restore(nextSnapshot);
      return current;
    });
    if (ok) {
      markDirty();
      setStatus('已重做。', { clearError: true });
    }
    _refreshHistoryFlags();
    return ok;
  }

  function persistGraph(options = {}) {
    const payload = {
      schema: CONFIG_SCHEMA,
      version: CONFIG_VERSION,
      savedAt: nowIso(),
      ...graph.snapshot(),
    };
    const ok = storageRepo.save(payload);
    if (ok) {
      saveState.value = 'saved';
      if (options.setStatus !== false) {
        setStatus(`已自动保存（${new Date().toLocaleTimeString()}）。`, { clearError: true });
      }
    }
    return ok;
  }

  function _scheduleAutoSave() {
    if (!autoSaveEnabled.value) return;
    _clearAutoSaveTimer();
    _autoSaveTimer = window.setTimeout(() => {
      if (saveState.value === 'dirty') persistGraph({ setStatus: true });
    }, AUTO_SAVE_INTERVAL_MS);
  }

  function _clearAutoSaveTimer() {
    if (_autoSaveTimer != null) {
      window.clearTimeout(_autoSaveTimer);
      _autoSaveTimer = null;
    }
  }

  function loadFromStorage() {
    const raw = storageRepo.load();
    if (raw && !Array.isArray(raw) && typeof raw === 'object' && !Array.isArray(raw.nodes)) {
      const legacyNodes = legacyNodesRepo.load();
      if (Array.isArray(legacyNodes) && legacyNodes.length > 0) {
        graph.restore({ nodes: legacyNodes, buses: [], links: [], config: raw });
        history.reset();
        setStatus('已加载历史节点数据（从旧版本兼容格式恢复）。', { clearError: true });
        return true;
      }
    }
    const normalized = normalizeSnapshotForRestore(raw);
    if (normalized) {
      graph.restore(normalized);
    }
    history.reset();
    saveState.value = 'saved';
    _refreshHistoryFlags();
    return normalized != null;
  }

  function resetAll(newGraph = null) {
    if (newGraph instanceof CanArchitectureGraph) {
      graph.restore(newGraph.snapshot());
    } else {
      const fresh = newGraph && typeof newGraph === 'object' ? newGraph : {};
      graph.restore({
        nodes: fresh.nodes ?? [],
        buses: fresh.buses ?? [],
        links: fresh.links ?? [],
        config: { ...graph.config, ...(fresh.config ?? {}) },
      });
    }
    history.reset();
    _refreshHistoryFlags();
    markDirty();
  }

  function addNode(data = {}) {
    const node = new CanNode(data);
    graph.addNode(node);
    return node;
  }

  function addBus(data = {}) {
    const bus = new CanBus(data);
    graph.addBus(bus);
    return bus;
  }

  function removeNodeById(id) {
    const removed = graph.removeNode(id);
    if (removed) markDirty();
    return removed;
  }

  function removeBusById(id) {
    const removed = graph.removeBus(id);
    if (removed) markDirty();
    return removed;
  }

  function removeLinkById(id) {
    const removed = graph.removeLink(id);
    if (removed) markDirty();
    return removed;
  }

  function touchAllSelected(nodeIds) {
    const set = new Set(Array.isArray(nodeIds) ? nodeIds : []);
    for (const node of graph.nodes) {
      if (set.has(node.id)) node.touch();
    }
  }

  watch(
    () => graph.snapshot(),
    () => {
      markDirty();
      _scheduleAutoSave();
    },
    { deep: true }
  );

  return {
    graph,
    nodes,
    buses,
    links,
    appConfig,
    statusText,
    statusError,
    saveState,
    autoSaveEnabled,
    canUndo,
    canRedo,
    history,
    setStatus,
    markDirty,
    pushHistorySnapshot,
    undo,
    redo,
    persistGraph,
    loadFromStorage,
    resetAll,
    addNode,
    addBus,
    removeNodeById,
    removeBusById,
    removeLinkById,
    touchAllSelected,
    nowIso,
    dispose() {
      _clearAutoSaveTimer();
    },
  };
}